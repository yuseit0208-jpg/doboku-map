// xROAD の生データ(raw/*.json.gz) → 地図用の点データ pts.bin と 県ごとの詳細 d/NN.json
import * as d3 from "d3-geo"; import fs from "fs"; import zlib from "zlib";
const P=d3.geoAzimuthalEqualArea().center([138.5, 36 - 18 / 60]).rotate([-138.5, -36 + 18 / 60]).scale([1700]).translate([2500, -1930]);
const RAW=process.env.RAW||"raw", OUT=process.argv[2]||"out";
fs.mkdirSync(OUT+"/d",{recursive:true});
const files=fs.readdirSync(RAW).filter(f=>f.endsWith(".json.gz")).sort();
const byPref={};
for(const f of files){const p=f.slice(0,2);(byPref[p]??=[]).push(...JSON.parse(zlib.gunzipSync(fs.readFileSync(RAW+"/"+f))).result)}
// x,y は 0.01 単位で uint16（x: 0..655, y: -20..635）
const SX=100, OY=20, XS=[],YS=[],YR=[],LN=[],HT=[],KB=[],TN=[];
const prefs=[];let skipped=0, n=0;const seen=new Set();let dup=0;
const stat={};
for(const p of Object.keys(byPref).sort()){
  const rows=[],cities=[],ci={},mg=[],mi={};const start=n;
  for(const r of byPref[p]){
    const s=r.syogen||{}, ic=s.ichi||{}; if(!(ic.ido>20&&ic.ido<46&&ic.keido>122&&ic.keido<154)){skipped++;continue}
    const key=r.shisetsu_id+"|"+r.kanrisya_code+"|"+(s.shisetsu?.meisyou||"");if(seen.has(key)){dup++;continue}seen.add(key);
    const [x,y]=P([ic.keido,ic.ido]);const X=Math.round(x*SX),Y=Math.round((y+OY)*SX);
    if(X<0||X>65535||Y<0||Y>65535){skipped++;continue}
    const ys=+(s.kasetsu_nendo||0);const yr=ys>1800&&ys<2027?ys:0;
    const h=+(r.tenken?.kiroku?.hantei_kubun||0);const hk=h>=1&&h<=4?h:0;
    const kb=+(s.kanrisya?.kubun||0);
    XS.push(X);YS.push(Y);YR.push(yr);LN.push(Math.min(65535,Math.round((s.kyouchou||0)*10)));HT.push(hk);KB.push(kb);TN.push(r.tenken?.nendo?r.tenken.nendo-2000:0);
    const cn=s.gyousei_kuiki?.shikuchouson_mei||"";if(!(cn in ci)){ci[cn]=cities.length;cities.push(cn)}
    const mn=s.kanrisya?.meisyou||"";if(!(mn in mi)){mi[mn]=mg.length;mg.push(mn)}
    const nm=(s.shisetsu?.meisyou||"").trim();
    rows.push([nm,ci[cn],mi[mn],(s.rosen?.meisyou||"").trim(),s.fukuin||0,r.tenken?.nendo||0,+ic.ido.toFixed(5),+ic.keido.toFixed(5)]);n++;
  }
  prefs.push([+p,start,n]);
  fs.writeFileSync(`${OUT}/d/${p}.json`,JSON.stringify({c:cities,m:mg,r:rows}));
}
// 列ごとに並べる（SoA）: x u16, y u16, year u16, len u16, hantei u8, kubun u8, tenken年-2000 u8, pad u8
const buf=Buffer.alloc(n*11);let o=0;
const w16=a=>{for(const v of a){buf.writeUInt16LE(v,o);o+=2}}, w8=a=>{for(const v of a){buf.writeUInt8(Math.max(0,Math.min(255,v)),o);o+=1}};
w16(XS);w16(YS);w16(YR);w16(LN);w8(HT);w8(KB);w8(TN);
fs.writeFileSync(OUT+"/pts.bin",buf);
fs.writeFileSync(OUT+"/meta.json",JSON.stringify({n,prefs,sx:SX,oy:OY,updated:new Date().toISOString().slice(0,10)}));
console.log({n,skipped,dup,bytes:buf.length});
