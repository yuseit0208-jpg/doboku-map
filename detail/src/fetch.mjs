// 名所ごとの詳細地図データを作る
//  道路・鉄道・川・水面・市区町村境・駅名・橋名 … 国土地理院 最適化ベクトルタイル（optimal_bvmap-v1, z16）
//  等高線 … 国土地理院 標高タイル（dem5a → dem10b の順で使う）
// 使い方: node fetch.mjs <zenkoku/index.html> <出力フォルダ> [id ...]
// 出力: <出力フォルダ>/<id>.json  （すでにあるものは飛ばす。作り直すときは消してから）
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import { contours } from "d3-contour";
import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";

const [, , SRC, OUT, ...ONLY] = process.argv;
const RADIUS = 900;            // 名所から半径 m（正方形の半辺）
const SIMP = 2.5;              // 線を間引く許容誤差 m
const UA = "doboku-map-builder/1.0 (https://github.com/yuseit0208-jpg/doboku-map)";

const html = fs.readFileSync(SRC, "utf8");
const RAW = JSON.parse(html.match(/const RAW=(\[.*?\]);\n/s)[1]);
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const M_LAT = 111320;

function frame(lat, lon) {
  const mLon = M_LAT * Math.cos(lat * Math.PI / 180);
  const dLat = RADIUS / M_LAT, dLon = RADIUS / mLon;
  return {
    lat, lon, mLon,
    s: lat - dLat, n: lat + dLat, w: lon - dLon, e: lon + dLon,
    xy: (la, lo) => [(lo - lon) * mLon, (lat - la) * M_LAT], // x=東, y=南（SVGと同じ向き）
  };
}

// ---------- 線の整理 ----------
function dp(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let mx = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = dx === 0 && dy === 0 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L;
      if (d > mx) { mx = d; mi = i; }
    }
    if (mx > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
// 枠の外に大きくはみ出した部分を切る（枠＋余白の外側の点が続く区間を落とす）
function clipLine(pts, lim) {
  const out = []; let cur = [];
  const inb = p => Math.abs(p[0]) <= lim && Math.abs(p[1]) <= lim;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], keep = inb(p) || (i > 0 && inb(pts[i - 1])) || (i < pts.length - 1 && inb(pts[i + 1]));
    if (keep) cur.push(p); else if (cur.length) { if (cur.length > 1) out.push(cur); cur = []; }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}
// 面を枠（±lim の正方形）で切る（Sutherland–Hodgman）
function clipPoly(pts, lim) {
  const edges = [[0, -1], [0, 1], [1, -1], [1, 1]];
  let out = pts;
  for (const [ax, sg] of edges) {
    const inp = out; out = []; if (!inp.length) break;
    const ins = p => sg * p[ax] <= lim;
    for (let i = 0; i < inp.length; i++) {
      const P = inp[i], Q = inp[(i + 1) % inp.length], pi = ins(P), qi = ins(Q);
      if (pi) out.push(P);
      if (pi !== qi) { const t = (sg * lim - P[ax]) / (Q[ax] - P[ax]); out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]); }
    }
  }
  return out;
}
// 別々の線をつないで輪にする（マルチポリゴンの外周）
function joinRings(parts) {
  const rings = [], open = parts.map(p => p.slice());
  while (open.length) {
    let cur = open.shift(), grew = true;
    while (grew && !(cur.length > 3 && cur[0][0] === cur[cur.length - 1][0] && cur[0][1] === cur[cur.length - 1][1])) {
      grew = false;
      for (let i = 0; i < open.length; i++) {
        const o = open[i], e = cur[cur.length - 1];
        const eq = (a, b) => a[0] === b[0] && a[1] === b[1];
        if (eq(o[0], e)) cur = cur.concat(o.slice(1));
        else if (eq(o[o.length - 1], e)) cur = cur.concat(o.slice().reverse().slice(1));
        else if (eq(o[o.length - 1], cur[0])) cur = o.concat(cur.slice(1));
        else if (eq(o[0], cur[0])) cur = o.slice().reverse().concat(cur.slice(1));
        else continue;
        open.splice(i, 1); grew = true; break;
      }
    }
    if (cur.length > 3 && cur[0][0] === cur[cur.length - 1][0] && cur[0][1] === cur[cur.length - 1][1]) rings.push(cur);
  }
  return rings;
}
// 座標を整数mにして差分で詰める: [x0,y0,dx1,dy1,...]
function enc(pts) {
  const a = []; let px = 0, py = 0;
  for (const [x, y] of pts) { const X = Math.round(x), Y = Math.round(y); a.push(X - px, Y - py); px = X; py = Y; }
  return a;
}

// ---------- 国土地理院 最適化ベクトルタイル ----------
const VT = "https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1";
const VZ = 16;
const vtCache = new Map();
async function vtile(x, y) {
  const k = x + "/" + y; if (vtCache.has(k)) return vtCache.get(k);
  const v = await vtile0(x, y); vtCache.set(k, v); return v;
}
async function vtile0(x, y) {
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(`${VT}/${VZ}/${x}/${y}.pbf`, { headers: { "user-agent": UA } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("vt " + r.status);
      return new VectorTile(new Pbf(Buffer.from(await r.arrayBuffer())));
    } catch (e) { if (t === 3) throw e; await sleep(2000 * (t + 1)); }
  }
}
function roadClass(p) {
  const c = p.vt_code, k = Math.floor(c / 10) % 10;          // 270x 道路, 271x 軽車道, 272x 徒歩道・庭園路, 273x 階段
  if (k >= 2) return 5;
  const g = p.vt_rdctg || "";
  if (g.startsWith("高速") || g === "国道") return 1;
  if (g === "都道府県道" || g === "主要道路") return 2;
  const w = p.vt_rnkwidth || "";
  if (w.startsWith("13m") || w.startsWith("19.5m") || w.startsWith("5.5m")) return 3;
  return 4;
}
async function gsiLayers(f) {
  const lim = RADIUS * 1.15, L = { road: [], rail: [], river: [], water: [], park: [], coast: [], bound: [], sta: [], lab: [], anno: [] };
  const [x0, y0] = tileXY(f.n, f.w, VZ).map(Math.floor), [x1, y1] = tileXY(f.s, f.e, VZ).map(Math.floor);
  const N = 2 ** VZ;
  const push = (arr, pts, extra, eps = SIMP) => { for (const seg of clipLine(pts, lim)) { const q = dp(seg, eps); if (q.length > 1) arr.push(extra ? [...extra, enc(q)] : enc(q)); } };
  const labels = [];
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const t = await vtile(tx, ty); if (!t) continue;
    const each = (name, fn) => { const l = t.layers[name]; if (!l) return; const E = l.extent;
      const toXY = p => { const wx = (tx + p.x / E) / N, wy = (ty + p.y / E) / N; const lon = wx * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * wy))) * 180 / Math.PI; return f.xy(lat, lon); };
      for (let i = 0; i < l.length; i++) { const ft = l.feature(i); fn(ft.properties, ft.loadGeometry().map(r => r.map(toXY)), ft.type); } };
    each("RdCL", (p, g) => { const c = roadClass(p), last = p.vt_code % 10; const fl = (last === 3 ? 1 : 0) + (last === 4 ? 2 : 0); for (const r of g) push(L.road, r, [c, fl]); });
    each("RailCL", (p, g) => { const st = p.vt_railstate || "", sub = p.vt_rtcode === "地下鉄" || st === "地下";
      const k = sub ? 2 : 1, fl = (st === "橋・高架" ? 1 : 0) + (st === "トンネル" || st === "地下" || st === "雪覆い" ? 2 : 0) + (p.vt_sngldbl === "駅部分" ? 4 : 0);
      for (const r of g) push(L.rail, r, [k, fl]); });
    each("RailTrCL", (p, g) => { for (const r of g) push(L.rail, r, [3, 0]); });
    each("RvrCL", (p, g) => { if (p.vt_code === 5322) return; for (const r of g) push(L.river, r, [2]); });
    each("WA", (p, g, ty3) => { if (ty3 !== 3) return; const rings = []; for (const r of g) { const c = clipPoly(r, lim); if (c.length > 3) { const q = dp(c.concat([c[0]]), SIMP); if (q.length > 3) rings.push(enc(q)); } } if (rings.length) L.water.push(rings); });
    each("Cstline", (p, g) => { for (const r of g) push(L.coast, r, null); });
    each("AdmBdry", (p, g) => { if (p.vt_code !== 1211 && p.vt_code !== 1212) return; for (const r of g) push(L.bound, r, [p.vt_code === 1211 ? 4 : 7], 4); });
    each("Anno", (p, g, ty3) => {
      const c = p.vt_code, txt = p.vt_text; if (!txt) return;
      if (c === 413) { const pts = g.flat(); const m = pts[pts.length >> 1]; if (m) L.anno.push([m[0], m[1], txt, c]); }
      else if (ty3 === 1 && !(c >= 321 && c <= 329) && ![110, 210, 421, 800].includes(c)) for (const q of g.flat()) L.anno.push([q[0], q[1], txt, c]);
      const kind = c === 422 ? "s" : c === 413 ? "b" : (c >= 321 && c <= 329) ? "w" : c === 110 ? "m" : c === 421 ? "r" : null; if (!kind) return;
      const pts = g.flat(); const m = pts[pts.length >> 1]; if (!m) return;
      let ang = 0; if (ty3 === 2 && pts.length > 1) { const A = pts[0], B = pts[pts.length - 1]; ang = Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180; }
      if (Math.abs(m[0]) > RADIUS || Math.abs(m[1]) > RADIUS) return;
      labels.push([kind, Math.round(m[0]), Math.round(m[1]), txt, Math.round(ang)]);
    });
  }
  // タイルの境で同じ注記が重なるので、近くの同名は1つに
  for (const l of labels) if (!L.lab.some(o => o[0] === l[0] && o[3] === l[3] && Math.hypot(o[1] - l[1], o[2] - l[2]) < 250)) L.lab.push(l);
  L.sta = L.lab.filter(l => l[0] === "s").map(l => [l[1], l[2], l[3].replace(/駅$/, "")]);
  L.lab = L.lab.filter(l => l[0] !== "s");
  return L;
}

// ---------- 等高線（国土地理院 標高タイル） ----------
function tileXY(lat, lon, z) {
  const n = 2 ** z, x = (lon + 180) / 360 * n, s = Math.sin(lat * Math.PI / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
  return [x, y];
}
const tileCache = new Map();
async function demTile(kind, z, x, y) {
  const k = `${kind}/${z}/${x}/${y}`; if (tileCache.has(k)) return tileCache.get(k);
  const url = `https://cyberjapandata.gsi.go.jp/xyz/${kind}/${z}/${x}/${y}.png`;
  let v = null;
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA } });
      if (r.status === 404) break;
      if (!r.ok) throw new Error("dem " + r.status);
      const png = PNG.sync.read(Buffer.from(await r.arrayBuffer()));
      const h = new Float32Array(256 * 256);
      for (let i = 0; i < 256 * 256; i++) {
        const R = png.data[i * 4], G = png.data[i * 4 + 1], B = png.data[i * 4 + 2];
        if (R === 128 && G === 0 && B === 0) { h[i] = NaN; continue; }   // 標高なし
        let u = R * 65536 + G * 256 + B; if (u >= 8388608) u -= 16777216;
        h[i] = u * 0.01;
      }
      v = h; break;
    } catch (e) { if (t === 2) throw e; await sleep(2000); }
  }
  tileCache.set(k, v); return v;
}
const KINDS = [["dem5a_png", 15], ["dem5b_png", 15], ["dem_png", 14]];
async function demAt(lat, lon) {
  // 細かい 5m メッシュから順に見て、値がなければ 10m メッシュへ。どれにもなければ海（NaN）
  for (const [kind, z] of KINDS) {
    let [px, py] = tileXY(lat, lon, z); px *= 256; py *= 256;
    const X0 = Math.floor(px - .5), Y0 = Math.floor(py - .5), fx = px - .5 - X0, fy = py - .5 - Y0;
    const sample = async (X, Y) => { const t = await demTile(kind, z, Math.floor(X / 256), Math.floor(Y / 256)); return t ? t[(Y & 255) * 256 + (X & 255)] : NaN; };
    const a = await sample(X0, Y0), b = await sample(X0 + 1, Y0), c = await sample(X0, Y0 + 1), d = await sample(X0 + 1, Y0 + 1);
    let v = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    if (Number.isNaN(v)) { const ok = [a, b, c, d].filter(q => !Number.isNaN(q)); if (ok.length >= 2) v = ok.reduce((s, q) => s + q, 0) / ok.length; }
    if (!Number.isNaN(v)) return v;
  }
  return NaN;
}
async function demGrid(f) {
  const STEP = 6, n = Math.round(2 * RADIUS / STEP) + 1, grid = new Float64Array(n * n);
  let nan = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = -RADIUS + i * STEP, y = -RADIUS + j * STEP;
    const v = await demAt(f.lat - y / M_LAT, f.lon + x / f.mLon);
    if (Number.isNaN(v)) nan++;
    grid[j * n + i] = v;
  }
  return { grid, n, STEP, nan };
}
function contourLayer(dem) {
  const { grid, n, STEP } = dem;
  let lo = Infinity, hi = -Infinity;
  for (const v of grid) if (!Number.isNaN(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (!(hi > lo)) return null;
  const rel = hi - lo;
  const iv = rel < 30 ? 2 : rel < 80 ? 5 : rel < 250 ? 10 : rel < 600 ? 20 : 50;   // 起伏に合わせて間隔を変える
  const g = Array.from(grid, v => Number.isNaN(v) ? 0 : v);                   // 海は標高0として扱う
  const th = []; for (let h = Math.ceil(Math.max(lo, 0.5) / iv) * iv; h <= hi; h += iv) th.push(h);
  const cs = contours().size([n, n]).thresholds(th)(g);
  const lines = [];
  for (const c of cs) {
    const major = Math.round(c.value) % (iv * 5) === 0 ? 1 : 0;
    for (const polyg of c.coordinates) for (const ring of polyg) {
      // 枠のふちを沿う部分は線として描かない
      const pts = ring.map(([i, j]) => [-RADIUS + (i - .5) * STEP, -RADIUS + (j - .5) * STEP]);
      const segs = []; let cur = [];
      const edge = p => Math.abs(p[0]) >= RADIUS - STEP * .6 || Math.abs(p[1]) >= RADIUS - STEP * .6;
      for (const p of pts) { if (edge(p)) { if (cur.length > 1) segs.push(cur); cur = []; } else cur.push(p); }
      if (cur.length > 1) segs.push(cur);
      for (const s of segs) { const q = dp(s, 2); if (q.length > 2) lines.push([Math.round(c.value * 10) / 10, major, enc(q)]); }
    }
  }
  // 標高データのない所＝海。まとまった面として持つ
  let sea = [];
  if (dem.nan > n * 2) {
    const mask = Array.from(grid, v => Number.isNaN(v) ? 1 : 0);
    const [m] = contours().size([n, n]).thresholds([0.5])(mask);
    for (const polyg of m.coordinates) {
      const rings = polyg.map(r => enc(dp(r.map(([i, j]) => [-RADIUS + (i - .5) * STEP, -RADIUS + (j - .5) * STEP]), 3)));
      if (rings[0].length > 6) sea.push(rings);
    }
  }
  // 名所の地点の標高と、範囲の最高・最低
  const mid = (n - 1) / 2, at = grid[mid * n + mid];
  return { iv, lo: Math.round(lo * 10) / 10, hi: Math.round(hi * 10) / 10, at: Number.isNaN(at) ? null : Math.round(at * 10) / 10, sea, lines };
}

// 名所の座標がずれていることがあるので、地図の注記に同じ名前があればそこへ寄せる
const norm = s => String(s).replace(/[（(][^）)]*[）)]/g, "").replace(/[\s・　]/g, "").replace(/^(旧|国指定)/, "");
function snap(name, anno) {
  const n = norm(name); let best = null;
  for (const [x, y, t, c] of anno) {
    const a = norm(t); if (a.length < 2) continue;
    let score = a === n ? 3 : (n.includes(a) && a.length >= 3 && a.length / n.length >= .5) ? 2 : (a.includes(n) && n.length >= 3 && a.length <= n.length + 4) ? 1 : 0;
    if (!score) continue;
    const d = Math.hypot(x, y); if (d > (c === 413 ? 1200 : 120)) continue;   // 橋名の注記は信頼できるので遠くまで、施設名は注記が建物の横に付くことが多いので近くだけ
    if (!best || score > best.score || (score === best.score && d < best.d)) best = { x, y, t, c, d, score };
  }
  return best;
}

// ---------- 本体 ----------
// far.mjs の照合で見つけた大きなずれ（id → [lat, lon, 注記, ずれm, 種別]）
const FIX = fs.existsSync(path.join(path.dirname(SRC), "fix.json")) ? JSON.parse(fs.readFileSync(path.join(path.dirname(SRC), "fix.json"), "utf8")) : {};
const list = RAW.filter(a => !ONLY.length || ONLY.includes(a[0]));
let done = 0;
for (const a of list) {
  const id = a[0], lat0 = a[10], lon0 = a[11], F = FIX[id], lat = F ? F[0] : lat0, lon = F ? F[1] : lon0, out = path.join(OUT, id + ".json");
  if (fs.existsSync(out)) { done++; continue; }
  if (lat0 == null) continue;
  let f = frame(lat, lon);
  const t0 = Date.now();
  try {
    let L = await gsiLayers(f), fix = null;
    const sn = snap(a[1], L.anno);
    if (sn && sn.d > 40) {
      const la = lat - sn.y / M_LAT, lo = lon + sn.x / f.mLon;
      fix = { ll: [+la.toFixed(6), +lo.toFixed(6)], by: sn.t, m: Math.round(sn.d) };
      f = frame(la, lo); L = await gsiLayers(f);
    } else if (sn) fix = { ll: [lat, lon], by: sn.t, m: Math.round(sn.d) };
    if (F) { const mLon = M_LAT * Math.cos(lat0 * Math.PI / 180); fix = { ll: [+f.lat.toFixed(6), +f.lon.toFixed(6)], by: F[2], m: Math.round(Math.hypot((f.lon - lon0) * mLon, (f.lat - lat0) * M_LAT)) }; }
    let C = null;
    try { C = contourLayer(await demGrid(f)); } catch (e) { console.warn("  等高線なし", id, e.message); }
    tileCache.clear(); vtCache.clear();
    const res = { v: 2, id, ll: [+f.lat.toFixed(6), +f.lon.toFixed(6)], ll0: [lat0, lon0], fix, r: RADIUS, made: new Date().toISOString().slice(0, 10),
      road: L.road, rail: L.rail, river: L.river, water: L.water, coast: L.coast, bound: L.bound, sta: L.sta, lab: L.lab, contour: C };
    fs.writeFileSync(out, JSON.stringify(res));
    done++;
    console.log(`${done}/${list.length} ${id} ${fix ? "→" + fix.by + " " + fix.m + "m " : ""}${(fs.statSync(out).size / 1024).toFixed(0)}KB ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) { console.error("失敗", id, e.message); }
  await sleep(300);
}
