// 名所のまわりの詳細地図（土木散歩・名所帖で共用）
// 使い方: DetailMap.open(d, {base:"detail/", spots:D, here:[lat,lon]|null, onSpot:id=>{}})
//  d = {id,name,ll:[lat,lon],cat,...}。データは base+id+".json"（fetch.mjs が作る）
(function(){
var CSS='\
.dm{position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;background:var(--bg,#F4F0E5);color:var(--ink,#1F2326)}\
.dm[hidden]{display:none}\
.dm-hd{display:flex;align-items:center;gap:10px;padding:10px 12px 8px;padding-top:max(10px,env(safe-area-inset-top));border-bottom:2px solid var(--m-navy,#2C4E8C)}\
.dm-hd .t{flex:1;min-width:0}\
.dm-hd b{display:block;font:800 18px/1.25 var(--f-disp,serif);letter-spacing:.05em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\
.dm-hd small{display:block;font-size:11.5px;color:var(--ink2,#5C6368)}\
.dm-x{flex:none;width:40px;height:40px;border-radius:50%;border:1px solid var(--rule,#DCD5C4);background:var(--paper,#fff);display:grid;place-items:center;cursor:pointer}\
.dm-x svg{width:18px;height:18px;stroke:currentColor;stroke-width:2;fill:none}\
.dm-box{position:relative;flex:1;min-height:0;overflow:hidden;touch-action:none;background:var(--m-land,#F2EEE2);outline:3px solid var(--m-navy,#2C4E8C);outline-offset:-9px}\
.dm-box svg.dm-svg{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab}\
.dm-box svg.dm-svg:active{cursor:grabbing}\
.dm-msg[hidden]{display:none}\
.dm-msg{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;font-size:14px;color:var(--ink2,#5C6368)}\
.dm-tools{position:absolute;right:16px;top:16px;display:flex;flex-direction:column;gap:8px}\
.dm-tools button{width:42px;height:42px;border-radius:10px;border:1px solid var(--rule,#DCD5C4);background:var(--paper,#fff);font:700 20px/1 var(--f-body,sans-serif);cursor:pointer;display:grid;place-items:center;box-shadow:0 1px 3px rgba(0,0,0,.12)}\
.dm-tools button svg{width:20px;height:20px;stroke:currentColor;stroke-width:1.8;fill:none}\
.dm-ct{position:absolute;left:16px;top:16px;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;border:1px solid var(--rule,#DCD5C4);background:var(--paper,#fff);font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.12)}\
.dm-ct i{width:30px;height:18px;border-radius:9px;background:var(--rule,#DCD5C4);position:relative;transition:background .2s}\
.dm-ct i:after{content:"";position:absolute;left:2px;top:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .2s}\
.dm-ct[aria-pressed="true"] i{background:#9A6A3A}\
.dm-ct[aria-pressed="true"] i:after{left:14px}\
.dm-scale{position:absolute;left:18px;bottom:16px;font:700 11px/1 var(--f-body,sans-serif);color:var(--ink,#1F2326)}\
.dm-scale span{display:block;height:6px;border:2px solid currentColor;border-top:0;margin-top:3px}\
.dm-ft{padding:8px 14px 10px;padding-bottom:max(10px,env(safe-area-inset-bottom));font-size:12px;color:var(--ink2,#5C6368);border-top:1px solid var(--rule,#DCD5C4);background:var(--paper,#fff)}\
.dm-lg{display:flex;flex-wrap:wrap;gap:4px 14px;margin-bottom:4px;color:var(--ink,#1F2326)}\
.dm-lg span{display:inline-flex;align-items:center;gap:5px}\
.dm-lg svg{width:26px;height:10px}\
.dm-ft .src{font-size:10.5px;color:var(--ink3,#8A9094)}\
.dm-svg path{vector-effect:non-scaling-stroke}\
.dm-svg text{text-anchor:start;dominant-baseline:auto}\
.dm-svg text[text-anchor="middle"]{text-anchor:middle}\
.dm-svg .w{fill:var(--m-water,#C7DAE1);stroke:var(--m-water,#C7DAE1);stroke-width:1.2}\
.dm-svg .wl{fill:none;stroke:var(--m-water,#C7DAE1);stroke-linecap:round;stroke-linejoin:round}\
.dm-svg .pk{fill:var(--m-park,#A8CBB2);opacity:.55}\
.dm-svg .cl{fill:none;stroke:#9A6A3A;opacity:.55;stroke-linejoin:round}\
.dm-svg .cl.mj{opacity:.8}\
.dm-svg .ctx{font:600 9px var(--f-body,sans-serif);fill:#9A6A3A;paint-order:stroke;stroke:var(--m-land,#F2EEE2);stroke-width:3px}\
.dm-svg .bd{fill:none;stroke:#7A5C8E;stroke-dasharray:10 4 2 4;stroke-linejoin:round}\
.dm-svg .rc{fill:none;stroke:var(--m-road2,#C3BFB5);stroke-linecap:round;stroke-linejoin:round}\
.dm-svg .rf{fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round}\
.dm-svg .rf.c1{stroke:#F2C77A}\
.dm-svg .rf.c2{stroke:#FBE7B0}\
.dm-svg .rf.c5{stroke:var(--m-road2,#C3BFB5);stroke-dasharray:3 3}\
.dm-svg .tu{stroke-dasharray:5 4;opacity:.55}\
.dm-svg .rl{fill:none;stroke:var(--m-rail,#7C8287)}\
.dm-svg .rl.tie{stroke:#fff;stroke-dasharray:7 7}\
.dm-svg .rl.k2{stroke-dasharray:3 4;stroke-width:3px}\
.dm-svg .dmst rect{fill:#fff;stroke:var(--ink,#1F2326)}\
.dm-svg .dmst text,.dm-svg .sp text{font:700 13px var(--f-body,sans-serif);fill:var(--ink,#1F2326);paint-order:stroke;stroke:var(--m-land,#F2EEE2);stroke-width:4px;stroke-linejoin:round}\
.dm-svg .sp{cursor:pointer}\
.dm-svg .cs{fill:none;stroke:#8FB7C8;stroke-width:1.2}\
.dm-svg .rs{fill:none;stroke:var(--ink,#1F2326);stroke-linecap:butt}\
.dm-svg .lb text{font:500 11px var(--f-body,sans-serif);fill:var(--ink2,#5C6368);paint-order:stroke;stroke:var(--m-land,#F2EEE2);stroke-width:3px;stroke-linejoin:round}\
.dm-svg .lb-w text{fill:#3F7F9A;font-style:italic;letter-spacing:.15em}\
.dm-svg .lb-m text{font:800 15px var(--f-disp,serif);fill:#7A5C8E;letter-spacing:.3em;opacity:.75}\
.dm-svg .lb-b text{fill:var(--c-bridge,#2F5E86);font-weight:700}\
.dm-svg .sp circle{stroke:#fff;stroke-width:2}\
.dm-svg .me path{fill:var(--m-star,#D8433F);stroke:#fff;stroke-width:2.5;stroke-linejoin:round}\
.dm-svg .me text{font:800 15px var(--f-disp,serif);fill:var(--ink,#1F2326);paint-order:stroke;stroke:#fff;stroke-width:5px;stroke-linejoin:round}\
.dm-svg .here circle{fill:var(--me,#2F6FD6);stroke:#fff;stroke-width:3}\
.dm-svg .nb path{fill:var(--ink,#1F2326)}\
.dm-svg .nb text{font:800 12px var(--f-body,sans-serif);fill:var(--ink,#1F2326)}\
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .dm-svg .rf{stroke:#5A666E}:root:not([data-theme="light"]) .dm-svg .rf.c1{stroke:#B08A45}:root:not([data-theme="light"]) .dm-svg .rf.c2{stroke:#8A7A50}:root:not([data-theme="light"]) .dm-svg .cl,:root:not([data-theme="light"]) .dm-svg .ctx{stroke:#C9A27A}:root:not([data-theme="light"]) .dm-svg .ctx{fill:#C9A27A}:root:not([data-theme="light"]) .dm-svg .bd{stroke:#B79AD6}:root:not([data-theme="light"]) .dm-svg .dmst rect{fill:#1F262B}:root:not([data-theme="light"]) .dm-svg .me path{stroke:#1F262B}}\
:root[data-theme="dark"] .dm-svg .rf{stroke:#5A666E}:root[data-theme="dark"] .dm-svg .rf.c1{stroke:#B08A45}:root[data-theme="dark"] .dm-svg .rf.c2{stroke:#8A7A50}:root[data-theme="dark"] .dm-svg .bd{stroke:#B79AD6}:root[data-theme="dark"] .dm-svg .dmst rect{fill:#1F262B}\
';
var NS="http://www.w3.org/2000/svg",el,box,svgEl,state=null,cache={};
function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function dec(a){var p=[],x=0,y=0;for(var i=0;i<a.length;i+=2){x+=a[i];y+=a[i+1];p.push([x,y])}return p}
function pth(a,close){var p=dec(a);return"M"+p.map(function(q){return q[0]+","+q[1]}).join("L")+(close?"Z":"")}
function star(x,y,r){var q=r*.38,s=[];for(var i=0;i<10;i++){var a=-Math.PI/2+i*Math.PI/5,rr=i%2?q:r;s.push((x+rr*Math.cos(a)).toFixed(1)+","+(y+rr*Math.sin(a)).toFixed(1))}return"M"+s.join("L")+"Z"}
function setup(){
  if(el)return;
  var st=document.createElement("style");st.textContent=CSS;document.head.appendChild(st);
  el=document.createElement("div");el.className="dm";el.hidden=true;el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-label","まわりの詳細地図");
  el.innerHTML='<div class="dm-hd"><div class="t"><b class="dm-title"></b><small class="dm-sub"></small></div><button class="dm-x" data-dm="close" aria-label="閉じる"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'+
  '<div class="dm-box"><div class="dm-msg">地図を読み込んでいます…</div>'+
  '<button class="dm-ct" data-dm="ct" aria-pressed="false"><i></i>等高線</button>'+
  '<div class="dm-tools"><button data-dm="in" aria-label="拡大">＋</button><button data-dm="out" aria-label="縮小">−</button><button data-dm="fit" aria-label="名所に戻る"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg></button></div>'+
  '<div class="dm-scale"></div></div>'+
  '<div class="dm-ft"><div class="dm-lg"></div><div class="src">出典: 国土地理院 最適化ベクトルタイル・標高タイルを加工して作成</div></div>';
  document.body.appendChild(el);
  box=el.querySelector(".dm-box");
  el.addEventListener("click",function(e){var b=e.target.closest("[data-dm]");if(!b)return;var a=b.dataset.dm;
    if(a==="close")close();else if(a==="in")zoom(1/1.6);else if(a==="out")zoom(1.6);else if(a==="fit")fit();
    else if(a==="ct"){var on=b.getAttribute("aria-pressed")!=="true";b.setAttribute("aria-pressed",on);store("dm-contour",on?"1":"0");if(svgEl)svgEl.querySelector(".g-ct").style.display=on?"":"none";legend()}});
  document.addEventListener("keydown",function(e){if(e.key==="Escape"&&!el.hidden)close()});
  // ドラッグ・ピンチ・ホイール
  var pts={},start=null;
  box.addEventListener("pointerdown",function(e){if(e.target.closest("button"))return;box.setPointerCapture(e.pointerId);pts[e.pointerId]=[e.clientX,e.clientY];start=snap()});
  box.addEventListener("pointermove",function(e){if(!pts[e.pointerId]||!state)return;var prev=pts[e.pointerId];pts[e.pointerId]=[e.clientX,e.clientY];var ids=Object.keys(pts);
    if(ids.length===1){var k=state.vb.w/box.clientWidth;state.vb.x-=(e.clientX-prev[0])*k;state.vb.y-=(e.clientY-prev[1])*k;state.moved=true;apply()}
    else if(ids.length===2){var a=pts[ids[0]],b=pts[ids[1]],o=ids[0]===String(e.pointerId)?[prev,b]:[a,prev];var d0=Math.hypot(o[0][0]-o[1][0],o[0][1]-o[1][1]),d1=Math.hypot(a[0]-b[0],a[1]-b[1]);if(d0>0){var r=box.getBoundingClientRect();zoom(d0/d1,(a[0]+b[0])/2-r.left,(a[1]+b[1])/2-r.top)}state.moved=true}});
  function up(e){delete pts[e.pointerId]}
  box.addEventListener("pointerup",up);box.addEventListener("pointercancel",up);
  box.addEventListener("wheel",function(e){e.preventDefault();var r=box.getBoundingClientRect();zoom(Math.exp(e.deltaY*.0015),e.clientX-r.left,e.clientY-r.top)},{passive:false});
  function snap(){return state&&{x:state.vb.x,y:state.vb.y}}
  box.addEventListener("click",function(e){var g=e.target.closest(".sp");if(g&&state&&state.onSpot&&!state.moved){var id=g.dataset.id;close();state.onSpot(id)}if(state)state.moved=false},true);
  void start;
}
function apply(){if(!svgEl||!state)return;var v=state.vb,R=state.r*1.1;
  v.w=Math.min(Math.max(v.w,R*.18),R*2.6);v.h=v.w*box.clientHeight/Math.max(box.clientWidth,1);
  v.x=Math.min(Math.max(v.x,-R-v.w*.3),R-v.w*.7);v.y=Math.min(Math.max(v.y,-R-v.h*.3),R-v.h*.7);
  svgEl.setAttribute("viewBox",v.x+" "+v.y+" "+v.w+" "+v.h);
  // 文字と記号は画面上の大きさを保つ
  var k=v.w/box.clientWidth;svgEl.style.setProperty("--k",k);
  svgEl.querySelectorAll(".lbl").forEach(function(g){g.setAttribute("transform","translate("+g.dataset.x+" "+g.dataset.y+") scale("+k+")")});
  scaleBar(k)}
function scaleBar(k){var s=el.querySelector(".dm-scale"),want=110*k,cand=[20,50,100,200,300,500,1000,2000],m=cand[0];cand.forEach(function(c){if(c<=want)m=c});s.innerHTML=(m>=1000?m/1000+"km":m+"m")+'<span style="width:'+(m/k).toFixed(0)+'px"></span>'}
function zoom(f,px,py){if(!state)return;var v=state.vb;if(px==null){px=box.clientWidth/2;py=box.clientHeight/2}var k=v.w/box.clientWidth,mx=v.x+px*k,my=v.y+py*k;v.w*=f;v.h*=f;k=v.w/box.clientWidth;v.x=mx-px*k;v.y=my-py*k;apply()}
function fit(){if(!state)return;var W=box.clientWidth,H=box.clientHeight,s=Math.min(W,H),w=state.r*1.2*W/s;state.vb={x:-w/2,y:-w/2*H/W,w:w,h:w*H/W};apply()}
function legend(){var on=el.querySelector(".dm-ct").getAttribute("aria-pressed")==="true",d=state&&state.data;
  function sw(inner){return'<svg viewBox="0 0 26 10">'+inner+"</svg>"}
  var h=[
   '<span>'+sw('<path d="M1 5H25" stroke="#C3BFB5" stroke-width="6"/><path d="M1 5H25" stroke="#F2C77A" stroke-width="4"/>')+"主な道路</span>",
   '<span>'+sw('<path d="M1 5H25" stroke="#7C8287" stroke-width="4"/><path d="M1 5H25" stroke="#fff" stroke-width="2" stroke-dasharray="4 4"/>')+"鉄道</span>",
   '<span>'+sw('<path d="M1 5H25" stroke="#8FB7C8" stroke-width="4"/>')+"川・水面</span>",
   '<span>'+sw('<path d="M1 5H25" stroke="#7A5C8E" stroke-width="1.6" stroke-dasharray="6 2 1.5 2"/>')+"市区町村の境</span>"];
  if(on&&d&&d.contour)h.push('<span>'+sw('<path d="M1 5H25" stroke="#9A6A3A" stroke-width="1.2"/>')+"等高線 "+d.contour.iv+"m ごと</span>");
  var x=[];if(d){var nm=function(k){var o=[];(d.lab||[]).forEach(function(l){if(l[0]===k&&o.indexOf(l[3])<0)o.push(l[3])});return o};var b=nm("m");if(b.length)x.push(b.join("・"));var w=nm("w");if(w.length)x.push("川: "+w.slice(0,4).join("・"));if(on&&d.contour&&d.contour.at!=null)x.push("名所の標高 約"+Math.round(d.contour.at)+"m")}
  el.querySelector(".dm-lg").innerHTML=h.join("")+(x.length?'<span style="flex-basis:100%;color:var(--ink2,#5C6368)">'+esc(x.join("　"))+"</span>":"")}
function draw(d,data,o){
  var h=[],R=data.r,k=1;
  function lines(arr,cls,widthFn,filter){arr.forEach(function(a){if(filter&&!filter(a))return;var cl=cls(a);h.push('<path class="'+cl+'" d="'+pth(a[a.length-1])+'" stroke-width="'+widthFn(a)+'"/>')})}
  h.push('<rect x="'+(-R*3)+'" y="'+(-R*3)+'" width="'+R*6+'" height="'+R*6+'" fill="var(--m-land,#F2EEE2)"/>');
  // 海・水面・公園
  if(data.contour&&data.contour.sea)data.contour.sea.forEach(function(p){h.push('<path class="w" fill-rule="evenodd" d="'+p.map(function(r){return pth(r,true)}).join("")+'"/>')});
  (data.park||[]).forEach(function(a){h.push('<path class="pk" d="'+pth(a,true)+'"/>')});
  data.water.forEach(function(a){h.push('<path class="w" fill-rule="evenodd" d="'+(typeof a[0]==="number"?pth(a,true):a.map(function(r){return pth(r,true)}).join(""))+'"/>')});
  lines(data.river,function(){return"wl"},function(a){return a[0]===1?4:1.8});
  (data.coast||[]).forEach(function(a){h.push('<path class="cs" d="'+pth(a)+'"/>')});
  // 等高線
  var ct=[];if(data.contour){var labelled=0;data.contour.lines.forEach(function(a){var p=a[2];ct.push('<path class="cl'+(a[1]?" mj":"")+'" d="'+pth(p)+'" stroke-width="'+(a[1]?1.2:.6)+'"/>');
    if(a[1]&&labelled<40){var q=dec(p);if(q.length>6){var m=q[q.length>>1];ct.push('<g class="lbl" data-x="'+m[0]+'" data-y="'+m[1]+'"><text class="ctx" text-anchor="middle" dy="3">'+Math.round(a[0])+"</text></g>");labelled++}}})}
  h.push('<g class="g-ct"'+(o.contour?"":' style="display:none"')+">"+ct.join("")+"</g>");
  // 市区町村界
  lines(data.bound,function(){return"bd"},function(a){return a[0]===4?2.6:1.6});
  // 道路（縁→中の2回描き）
  var W={1:7,2:5.5,3:3.6,4:2.2,5:1};
  var roads=data.road.slice().sort(function(a,b){return b[0]-a[0]});
  roads.forEach(function(a){if(a[0]===5)return;h.push('<path class="rc'+(a[1]&2?" tu":"")+'" d="'+pth(a[2])+'" stroke-width="'+(W[a[0]]+2)+'"/>')});
  roads.forEach(function(a){h.push('<path class="rf c'+a[0]+(a[1]&2?" tu":"")+'" d="'+pth(a[2])+'" stroke-width="'+W[a[0]]+'"/>')});
  // 鉄道（地下鉄は点線）
  data.rail.forEach(function(a){if(a[1]&4&&!(a[1]&2))h.push('<path class="rs" d="'+pth(a[2])+'" stroke-width="9"/>')});
  data.rail.forEach(function(a){var t=a[1]&2||a[0]===2?" k2":"";h.push('<path class="rl'+t+'" d="'+pth(a[2])+'" stroke-width="'+(a[0]===3?2.5:4)+'"/>');if(!t)h.push('<path class="rl tie" d="'+pth(a[2])+'" stroke-width="2"/>')});
  // 駅
  data.sta.forEach(function(s){h.push('<g class="lbl dmst" data-x="'+s[0]+'" data-y="'+s[1]+'"><rect x="-5" y="-5" width="10" height="10" rx="2" stroke-width="2"/><text x="9" y="5">'+esc(s[2])+"駅</text></g>")});
  // 橋・川・市区町村の名前
  (data.lab||[]).forEach(function(l){if(l[0]==="r"||l[3]===d.name)return;h.push('<g class="lbl lb lb-'+l[0]+'" data-x="'+l[1]+'" data-y="'+l[2]+'"><text text-anchor="middle" dy="4" transform="rotate('+(l[4]||0)+')">'+esc(l[3])+"</text></g>")});
  // ほかの名所
  var C=data.ll||d.ll,cos=Math.cos(C[0]*Math.PI/180);
  (o.spots||[]).forEach(function(s){if(s.id===d.id||!s.ll)return;var x=(s.ll[1]-C[1])*111320*cos,y=(C[0]-s.ll[0])*111320;if(Math.abs(x)>R||Math.abs(y)>R)return;
    var c=window.CATS&&CATS[s.cat]?"var("+CATS[s.cat].v+")":"#2F5E86";
    h.push('<g class="lbl sp" data-id="'+esc(s.id)+'" data-x="'+x.toFixed(0)+'" data-y="'+y.toFixed(0)+'"><circle r="7" fill="'+c+'"/><text x="11" y="5">'+esc(s.name)+"</text></g>")});
  // 現在地
  if(o.here){var hx=(o.here[1]-C[1])*111320*cos,hy=(C[0]-o.here[0])*111320;if(Math.abs(hx)<R*1.3&&Math.abs(hy)<R*1.3)h.push('<g class="lbl here" data-x="'+hx.toFixed(0)+'" data-y="'+hy.toFixed(0)+'"><circle r="8"/></g>')}
  // この名所
  h.push('<g class="lbl me" data-x="0" data-y="0"><path d="'+star(0,0,17)+'"/><text x="0" y="36" text-anchor="middle">'+esc(d.name)+"</text></g>");
  return'<svg class="dm-svg" xmlns="'+NS+'" viewBox="'+(-R)+" "+(-R)+" "+2*R+" "+2*R+'" role="img" aria-label="'+esc(d.name)+'のまわりの地図">'+h.join("")+'</svg>';
}
function load(base,id){if(cache[id])return Promise.resolve(cache[id]);return fetch(base+encodeURIComponent(id)+".json").then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(function(j){cache[id]=j;return j})}
function open(d,o){
  setup();o=o||{};var base=o.base||"detail/";
  var on=store("dm-contour")==="1";
  el.querySelector(".dm-title").textContent=d.name;
  el.querySelector(".dm-sub").textContent="まわり約1km・"+(d.area||d.place||"");
  el.querySelector(".dm-ct").setAttribute("aria-pressed",on);
  if(svgEl){svgEl.remove();svgEl=null}
  var msg=el.querySelector(".dm-msg");msg.hidden=false;msg.textContent="地図を読み込んでいます…";
  state={id:d.id,r:900,vb:{x:-900,y:-900,w:1800,h:1800},onSpot:o.onSpot,data:null,last:document.activeElement};
  el.hidden=false;document.documentElement.style.overflow="hidden";
  legend();
  setTimeout(function(){var x=el.querySelector(".dm-x");x&&x.focus({preventScroll:true})},30);
  load(base,d.id).then(function(data){if(!state||state.id!==d.id)return;state.data=data;state.r=data.r;
    msg.hidden=true;box.insertAdjacentHTML("afterbegin",draw(d,data,{contour:on,spots:o.spots,here:o.here}));svgEl=box.querySelector("svg.dm-svg");fit();legend()})
  .catch(function(){if(state&&state.id===d.id)msg.textContent="この名所の詳細地図はまだありません。"});
}
function close(){if(!el||el.hidden)return;el.hidden=true;document.documentElement.style.overflow="";var l=state&&state.last;if(l&&l.focus)try{l.focus({preventScroll:true})}catch(e){}}
function has(id,base){return load(base||"detail/",id).then(function(){return true},function(){return false})}
window.DetailMap={open:open,close:close,has:has};
})();
