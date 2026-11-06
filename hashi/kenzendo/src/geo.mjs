// 地図の下地: 都道府県の陸地（塗り）と市区町村の境界線。japan.json はすでに投影済みの座標。
import * as tc from "topojson-client"; import fs from "fs";
const t=JSON.parse(fs.readFileSync("node_modules/jpn-atlas/japan/japan.json"));
const r2=v=>Math.round(v*100)/100;
const flat=line=>line.flatMap(([x,y])=>[r2(x),r2(y)]);
const land=[];for(const f of tc.feature(t,t.objects.prefectures).features){const g=f.geometry;const ps=g.type==="Polygon"?[g.coordinates]:g.coordinates;for(const p of ps)land.push(p.map(flat))}
const pm=tc.mesh(t,t.objects.prefectures,(a,b)=>a!==b).coordinates.map(flat);
const mm=tc.mesh(t,t.objects.municipalities,(a,b)=>a!==b).coordinates.map(flat);
// 県ごとの範囲（県を選んだときに寄せる）
const bb={};for(const f of tc.feature(t,t.objects.prefectures).features){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;const g=f.geometry;const ps=g.type==="Polygon"?[g.coordinates]:g.coordinates;
 // 面積の大きい島だけで範囲をとる（離島で全体が小さくならないように）
 const area=r=>{let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=(r[j][0]+r[i][0])*(r[j][1]-r[i][1]);return Math.abs(a/2)};
 const big=Math.max(...ps.map(p=>area(p[0])));
 for(const p of ps){if(area(p[0])<big*0.15)continue;for(const [x,y] of p[0]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}}
 bb[+f.id]=[x0,y0,x1,y1].map(r2)}
fs.writeFileSync(process.argv[2]+"/geo.json",JSON.stringify({land,pm,mm,bb}));
console.log(fs.statSync(process.argv[2]+"/geo.json").size);
