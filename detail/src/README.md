# 名所のまわりの詳細地図

- fetch.mjs … 名所ごとのデータを作る。`npm i pngjs d3-contour @mapbox/vector-tile@1.3.1 pbf@3.2.1` のあと
  `NODE_USE_ENV_PROXY=1 node fetch.mjs ../../zenkoku/index.html ../data [id ...]` で ../data/<id>.json を作る（既存は飛ばす）。
  道路・鉄道・川・水面・市区町村境・駅名・橋名は国土地理院 最適化ベクトルタイル（optimal_bvmap-v1, z16）、
  等高線と海は国土地理院 標高タイル（dem5a→dem5b→dem 10m）。どちらも cyberjapandata.gsi.go.jp。
  名所から ±900m の正方形。座標は名所を原点にしたm単位（x=東, y=南）の差分圧縮。
  名所の座標がずれているとき、地図の注記に同じ名前（橋名は1.2km以内、施設名は300m以内）があればそこへ寄せる（fix に記録）。
- detail-map.js … 表示部品。`DetailMap.open(d,{base:"detail/",spots:D,here,onSpot})`。等高線は切り替え（localStorage に記憶）。
- inject.py … 散歩アプリ・名所帖の index.html に「まわりの地図」ボタンと detail-map.js を差し込む（再実行で入れ替え）。
- far.mjs … 名所名を約7km四方の地図注記から探し、大きくずれている名所を一覧にする（fix.json の元）。fetch.mjs は fix.json があればその位置を中心にする。
- ../position-fixes.csv … 詳細地図で直した位置の一覧（全国地図の元データ spots.mjs はまだ直していない）。
- overpass-api.de は許可しても相手側で接続を切られたため使っていない（2026-11-05）。
