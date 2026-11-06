// 国土地理院 最適化ベクトルタイルから TOKYO_MAPS 形式のエリア地図を作る
import fs from "fs"; import { VectorTile } from "@mapbox/vector-tile"; import Pbf from "pbf";
const AREAS = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const OUT = process.argv[3];
const Z = 16, UA = "doboku-map-builder/1.0 (https://github.com/yuseit0208-jpg/doboku-map)";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cache = new Map();
async function tile(x, y) {
  const k = x + "/" + y; if (cache.has(k)) return cache.get(k);
  for (let t = 0; t < 4; t++) { try {
    const r = await fetch(`https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/${Z}/${x}/${y}.pbf`, { headers: { "user-agent": UA } });
    if (r.status === 404) { cache.set(k, null); return null; }
    if (!r.ok) throw new Error(r.status);
    const v = new VectorTile(new Pbf(Buffer.from(await r.arrayBuffer()))); cache.set(k, v); return v;
  } catch (e) { if (t === 3) throw e; await sleep(1500 * (t + 1)); } }
}
const txy = (lat, lon) => { const n = 2 ** Z, s = Math.sin(lat * Math.PI / 180); return [(lon + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n]; };
function dp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let mx = 0, mi = -1; const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L; if (d > mx) { mx = d; mi = i; } }
    if (mx > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return pts.filter((_, i) => keep[i]);
}
function clipLine(pts, W, H, m) {
  const inb = p => p[0] >= -m && p[0] <= W + m && p[1] >= -m && p[1] <= H + m; const out = []; let cur = [];
  pts.forEach((p, i) => { const k = inb(p) || (i > 0 && inb(pts[i - 1])) || (i < pts.length - 1 && inb(pts[i + 1])); if (k) cur.push(p); else if (cur.length) { if (cur.length > 1) out.push(cur); cur = []; } });
  if (cur.length > 1) out.push(cur); return out;
}
function clipPoly(pts, W, H, m) {
  const ed = [[0, -m, 1], [0, W + m, -1], [1, -m, 1], [1, H + m, -1]]; let out = pts;
  for (const [ax, v, sg] of ed) { const inp = out; out = []; if (!inp.length) break; const ins = p => sg * (p[ax] - v) >= 0;
    for (let i = 0; i < inp.length; i++) { const P = inp[i], Q = inp[(i + 1) % inp.length], a = ins(P), b = ins(Q); if (a) out.push(P);
      if (a !== b) { const t = (v - P[ax]) / (Q[ax] - P[ax]); out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]); } } }
  return out;
}
const f1 = n => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, "");
const dstr = (pts, close) => "M" + pts.map(p => f1(p[0]) + "," + f1(p[1])).join("L") + (close ? "Z" : "");
const out = {};
for (const A of AREAS) {
  const [s, w, n, e] = A.bbox, lat0 = (s + n) / 2, c = Math.cos(lat0 * Math.PI / 180), W = 1000, k = W / ((e - w) * c), H = +((n - s) * k).toFixed(1);
  const P = (lat, lon) => [(lon - w) * c * k, (n - lat) * k];
  const mpp = (e - w) * c * 111320 / W;   // m / px
  const RW = { motorway: 20, primary: 24, secondary: 17, tertiary: 11, residential: 5.5, pedestrian: 4.5 };
  const roads = {}; Object.keys(RW).forEach(k => roads[k] = []);
  const water = [], rail = [];
  const [x0, y0] = txy(n, w).map(Math.floor), [x1, y1] = txy(s, e).map(Math.floor), N = 2 ** Z;
  let cnt = 0;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = await tile(tx, ty); cnt++; if (!t) continue;
    const each = (name, fn) => { const l = t.layers[name]; if (!l) return; const E = l.extent;
      const to = p => { const wx = (tx + p.x / E) / N, wy = (ty + p.y / E) / N; return P(Math.atan(Math.sinh(Math.PI * (1 - 2 * wy))) * 180 / Math.PI, wx * 360 - 180); };
      for (let i = 0; i < l.length; i++) { const f = l.feature(i); fn(f.properties, f.loadGeometry().map(r => r.map(to)), f.type); } };
    each("RdCL", (p, g) => {
      const last = p.vt_code % 10; if (last === 4) return;          // トンネルは描かない
      const kk = Math.floor(p.vt_code / 10) % 10, gg = p.vt_rdctg || "", wd = p.vt_rnkwidth || "";
      const cls = kk >= 2 ? "pedestrian" : gg.startsWith("高速") ? "motorway" : gg === "国道" ? "primary" : (gg === "都道府県道" || gg === "主要道路") ? "secondary" : (wd.startsWith("13m") || wd.startsWith("19.5m")) ? "tertiary" : "residential";
      for (const r of g) for (const seg of clipLine(r, W, H, 20)) { const q = dp(seg, 1.0); if (q.length > 1) roads[cls].push(dstr(q)); } });
    each("RailCL", (p, g) => { const st = p.vt_railstate || ""; if (p.vt_rtcode === "地下鉄" || st === "地下" || st === "トンネル") return;
      for (const r of g) for (const seg of clipLine(r, W, H, 20)) { const q = dp(seg, 0.6); if (q.length > 1) rail.push(dstr(q)); } });
    each("WA", (p, g, ty3) => { if (ty3 !== 3) return; for (const r of g) { const rr = r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.slice(0, -1) : r; const cp = clipPoly(rr, W, H, 2); if (cp.length > 2) { const q = dp(cp, 0.5); if (q.length > 2) water.push(dstr(q, true)); } } });
  }
  const order = ["pedestrian", "residential", "tertiary", "secondary", "primary", "motorway"];
  out[A.key] = { bbox: A.bbox, w: W, h: H, lat0, title: A.title, en: A.en, lede: A.lede, credit: "出典：国土地理院",
    layers: { water: water.join(""), sea: "", parks: "", roads: order.filter(k => roads[k].length).map(k => ({ cls: k, w: +(RW[k] / mpp).toFixed(2), d: roads[k].join("") })), rail: rail.join("") },
    labels: A.labels };
  console.error(A.key, "tiles", cnt, "mpp", mpp.toFixed(2), "size", JSON.stringify(out[A.key]).length);
}
fs.writeFileSync(OUT, JSON.stringify(out));
