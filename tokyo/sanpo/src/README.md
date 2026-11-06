# 東京 土木建築散歩 — 追加エリア地図の作り方

- `areas.json` … 追加エリアの定義（key, bbox=[南,西,北,東], 題名, 英題, 説明, 地名ラベル）
- `areas.mjs` … 国土地理院 最適化ベクトルタイル（optimal_bvmap-v1, z16）から道路・鉄道・水面を取り、`TOKYO_MAPS` と同じ形にする

```
npm i @mapbox/vector-tile@1.3.1 pbf@3.2.1
NODE_USE_ENV_PROXY=1 node areas.mjs areas.json out.json
```

out.json を `Object.assign(TOKYO_MAPS, …)` で包んで `../tokyo-maps-gsi.js` に置く。
エリアを足したら `../tokyo-mapdraw.js` の `AREA_KEYS` にも key を加える（先に書いたエリアが優先で名所が割り当てられる）。

- 国土地理院のタイルには公園の面がないので、追加エリアには公園の色を塗っていない。
- 名所を足すときは `../tokyo-data.js` の配列の末尾に加える（id は配列の順番。途中に入れると撮った写真とずれる）。
