#!/bin/sh
# 使い方: sh site.sh <出力先>  → <出力先>/index.html と data/
set -e
O=$1; rm -rf "$O"; mkdir -p "$O"
node process.mjs "$O/data"; node geo.mjs "$O/data"
cp template.html "$O/index.html"
base64 -w0 "$O/data/pts.bin" > "$O/data/pts.txt" && rm "$O/data/pts.bin"  # 配信できる形式にするため base64 の文字にする
