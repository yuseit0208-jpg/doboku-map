# 全国の橋 健全度マップ 元データと組み立て
- 元データ: 国土交通省 全国道路施設点検データベース（xROAD）の橋梁API
  `https://road-structures-db.mlit.go.jp/xROAD/api/v1/bridges?pref=<県コード2桁>&limit=5000&offset=<n>`
  （`city=` は6桁の市区町村コード。`pref=` で県ごとに取れる。全国 730,885件、2026-11-05 取得）
- 手順:
  1. `python3 dl.py "<県:件数 ...>"` で raw/ に生データ（gzip）を保存（5並列で約25分）
  2. `npm i jpn-atlas@1.0.2 d3-geo topojson-client`
  3. `sh site.sh <出力先>` → index.html と data/（pts.txt, meta.json, geo.json, d/NN.json）
- data/pts.txt: 全橋の点データ（base64）。列ごとに x,y,架設年度,橋長(0.1m) が uint16、判定区分,管理者区分,点検年度-2000 が uint8。
  x,y は日本の橋マップと同じ投影（jpn-atlas）の座標を100倍、yは+20してから100倍。
- data/d/NN.json: 県ごとの詳細 {c:市区町村名, m:管理者名, r:[名前,市区町村,管理者,路線,幅員,点検年度,緯度,経度]}。pts の順番と同じ。
- 判定区分 8・9 など 1〜4 以外は「判定なし」。架設年度 9999 や空は「不明」。位置のない16件は入れていない。
- 管理者区分: 1国 2都道府県 3道路公社 4政令市 5市区町村 6高速道路会社。
