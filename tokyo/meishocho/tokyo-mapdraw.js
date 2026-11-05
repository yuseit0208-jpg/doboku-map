// 東京 土木建築名所帖 — 地図の描画（台帳ページと散歩地図冊子で共用）
// 依存: tokyo-data.js (CATS, D), tokyo-maps.js (TOKYO_MAPS)
(function () {
  var AREA_KEYS = ["marunouchi", "sumida", "ueno", "wangan"];

  function proj(m) {
    var s = m.bbox[0], w = m.bbox[1], n = m.bbox[2], e = m.bbox[3];
    var c = Math.cos(m.lat0 * Math.PI / 180), k = m.w / ((e - w) * c);
    return function (lat, lon) { return [(lon - w) * c * k, (n - lat) * k]; };
  }
  function inside(m, ll, pad) {
    pad = pad || 0;
    var dl = (m.bbox[2] - m.bbox[0]) * pad, dw = (m.bbox[3] - m.bbox[1]) * pad;
    return ll && ll[0] > m.bbox[0] + dl && ll[0] < m.bbox[2] - dl && ll[1] > m.bbox[1] + dw && ll[1] < m.bbox[3] - dw;
  }
  // エリア内の名所（北から南の順に番号を振る）
  // 各名所は AREA_KEYS の順で最初に入るエリアにだけ載せる
  function areaOf(d) {
    for (var i = 0; i < AREA_KEYS.length; i++) {
      var a = TOKYO_MAPS[AREA_KEYS[i]];
      if (a && inside(a, d.ll, 0.02)) return AREA_KEYS[i];
    }
    return null;
  }
  function spots(key) {
    return D.filter(function (d) { return areaOf(d) === key; })
      .sort(function (a, b) { return b.ll[0] - a.ll[0] || a.ll[1] - b.ll[1]; })
      .map(function (d, i) { return { d: d, no: i + 1 }; });
  }
  function star(x, y, r) {
    var q = r * 0.28, p = [[0, -r], [q, -q], [r, 0], [q, q], [0, r], [-q, q], [-r, 0], [-q, -q]];
    return "M" + p.map(function (v) { return (x + v[0]).toFixed(1) + "," + (y + v[1]).toFixed(1); }).join("L") + "Z";
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function base(m, P) {
    var L = m.layers, h = [];
    h.push('<rect class="m-land" width="' + m.w + '" height="' + m.h + '"/>');
    if (L.sea) h.push('<path class="m-water" fill-rule="evenodd" d="' + L.sea + '"/>');
    if (L.water) h.push('<path class="m-water" fill-rule="evenodd" d="' + L.water + '"/>');
    if (L.parks) h.push('<path class="m-park" fill-rule="evenodd" d="' + L.parks + '"/>');
    L.roads.forEach(function (r) {
      h.push('<path class="m-road m-' + r.cls + '" stroke-width="' + r.w + '" d="' + r.d + '"/>');
    });
    if (L.rail) {
      h.push('<path class="m-rail" d="' + L.rail + '"/>');
      h.push('<path class="m-rail-dash" d="' + L.rail + '"/>');
    }
    (m.labels || []).forEach(function (l) {
      var p = P(l[1], l[2]);
      h.push('<text class="m-label" x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '">' + esc(l[0]) + "</text>");
    });
    return h.join("");
  }

  // opts.interactive: マーカーを button 相当にする / opts.selected: 強調する名所id
  function svg(key, opts) {
    opts = opts || {};
    var m = TOKYO_MAPS[key], P = proj(m), h = [];
    h.push('<svg class="tmap tmap-' + key + '" viewBox="0 0 ' + m.w + " " + m.h + '" role="img" aria-label="' + esc(m.title) + 'の地図">');
    h.push(base(m, P));
    if (key === "overview") {
      AREA_KEYS.forEach(function (k) {
        var a = TOKYO_MAPS[k]; if (!a) return;
        var p1 = P(a.bbox[2], a.bbox[1]), p2 = P(a.bbox[0], a.bbox[3]);
        h.push('<g class="m-area' + (opts.interactive ? " m-hit" : "") + '" data-area="' + k + '"' + (opts.interactive ? ' tabindex="0" role="button" aria-label="' + esc(a.title) + 'の詳細図を開く"' : "") + ">" +
          '<rect x="' + p1[0].toFixed(1) + '" y="' + p1[1].toFixed(1) + '" width="' + (p2[0] - p1[0]).toFixed(1) + '" height="' + (p2[1] - p1[1]).toFixed(1) + '"/>' +
          '<text x="' + (p1[0] + 4).toFixed(1) + '" y="' + (p1[1] - 6).toFixed(1) + '">' + esc(a.title) + "</text></g>");
      });
      D.forEach(function (d) {
        if (!inside(m, d.ll)) return;
        var p = P(d.ll[0], d.ll[1]);
        h.push('<circle class="m-dot' + (opts.interactive ? " m-hit" : "") + '" data-id="' + d.id + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="7.5" style="fill:var(' + CATS[d.cat].v + ')"' +
          (opts.interactive ? ' tabindex="0" role="button" aria-label="' + esc(d.name) + '"' : "") + "><title>" + esc(d.name) + "</title></circle>");
      });
    } else {
      spots(key).forEach(function (s) {
        var p = P(s.d.ll[0], s.d.ll[1]), sel = opts.selected === s.d.id;
        h.push('<g class="m-spot' + (sel ? " is-sel" : "") + (opts.interactive ? " m-hit" : "") + '" data-id="' + s.d.id + '"' +
          (opts.interactive ? ' tabindex="0" role="button" aria-label="' + s.no + " " + esc(s.d.name) + '"' : "") + ">" +
          '<path class="m-star" d="' + star(p[0], p[1], sel ? 21 : 16) + '"/>' +
          '<circle class="m-no-bg" cx="' + (p[0] + 17).toFixed(1) + '" cy="' + (p[1] - 17).toFixed(1) + '" r="13"/>' +
          '<text class="m-no" x="' + (p[0] + 17).toFixed(1) + '" y="' + (p[1] - 12).toFixed(1) + '">' + s.no + "</text>" +
          "<title>" + esc(s.d.name) + "</title></g>");
      });
    }
    h.push('<text class="m-credit" x="' + (m.w - 8) + '" y="' + (m.h - 8) + '">© OpenStreetMap contributors</text>');
    // 方位と縮尺
    var c = Math.cos(m.lat0 * Math.PI / 180), mpp = (m.bbox[3] - m.bbox[1]) * c * 111320 / m.w;
    var nice = [100, 200, 250, 500, 1000, 2000, 5000].find(function (v) { return v / mpp > 90; }) || 1000;
    var px = nice / mpp, y0 = m.h - 26;
    h.push('<g class="m-scale"><path d="M16,' + y0 + "v-6M16," + y0 + "h" + px.toFixed(1) + "v-6" + '"/><text x="16" y="' + (y0 + 16) + '">' + (nice >= 1000 ? nice / 1000 + " km" : nice + " m") + "</text></g>");
    h.push('<g class="m-north" transform="translate(' + (m.w - 30) + ',40)"><path d="M0,-22L8,8L0,2L-8,8Z"/><text y="-28">N</text></g>');
    h.push("</svg>");
    return h.join("");
  }
  window.TokyoMap = { AREA_KEYS: AREA_KEYS, spots: spots, svg: svg, inside: inside };
})();
