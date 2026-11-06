// 名所の名前を、まわり約7kmの地図注記（z14）から探して、元座標とのずれを出す
import fs from "fs"; import { VectorTile } from "@mapbox/vector-tile"; import Pbf from "pbf";
const RAW = JSON.parse(fs.readFileSync("src-zenkoku.html","utf8").match(/const RAW=(\[.*?\]);\n/s)[1]);
const norm = s => String(s).replace(/[（(][^）)]*[）)]/g, "").replace(/[\s・　]/g, "").replace(/^(旧|国指定)/, "");
const Z=14,N=2**Z;
const tx=(lat,lon)=>{const s=Math.sin(lat*Math.PI/180);return[(lon+180)/360*N,(0.5-Math.log((1+s)/(1-s))/(4*Math.PI))*N]};
const cache=new Map();
async function tile(x,y){const k=x+"/"+y;if(cache.has(k))return cache.get(k);let v=null;for(let t=0;t<3;t++){try{const r=await fetch(`https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/${Z}/${x}/${y}.pbf`);if(r.status===404)break;if(!r.ok)throw 0;v=new VectorTile(new Pbf(Buffer.from(await r.arrayBuffer())));break}catch(e){await new Promise(r=>setTimeout(r,1500))}}cache.set(k,v);return v}
const out=[];
const work=RAW.slice();
async function one(a){
  const [fx,fy]=tx(a[10],a[11]);const n=norm(a[1]);const hits=[];
  for(let y=Math.floor(fy)-1;y<=Math.floor(fy)+1;y++)for(let x=Math.floor(fx)-1;x<=Math.floor(fx)+1;x++){const t=await tile(x,y);const l=t&&t.layers.Anno;if(!l)continue;
    for(let i=0;i<l.length;i++){const f=l.feature(i),txt=f.properties.vt_text;if(!txt)continue;const an=norm(txt);if(an!==n&&!(n.includes(an)&&an.length>=3&&an.length/n.length>=.6))continue;
      const g=f.loadGeometry().flat();const p=g[g.length>>1];const wx=(x+p.x/l.extent)/N,wy=(y+p.y/l.extent)/N;const lon=wx*360-180,lat=Math.atan(Math.sinh(Math.PI*(1-2*wy)))*180/Math.PI;
      const d=Math.hypot((lon-a[11])*111320*Math.cos(a[10]*Math.PI/180),(lat-a[10])*111320);hits.push([Math.round(d),txt,f.properties.vt_code,+lat.toFixed(5),+lon.toFixed(5)])}}
  hits.sort((p,q)=>p[0]-q[0]);if(hits.length)out.push([a[0],a[1],a[10],a[11],...hits[0]]);
}
async function worker(){while(work.length){const a=work.shift();await one(a)}}
await Promise.all([worker(),worker(),worker(),worker()]);
out.sort((p,q)=>q[4]-p[4]);
fs.writeFileSync("far.json",JSON.stringify(out));
for(const o of out)if(o[4]>250)console.log(o.join(" "));
console.log("matched",out.length);
