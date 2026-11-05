# 使い方: python3 inject.py <detail-map.js> <散歩アプリ index.html> <名所帖 index.html>
# 2回目以降は前回差し込んだ部分（DETAILMAP の印の間）を入れ替える
import sys,re
dm=open(sys.argv[1]).read()
BASE='window.DM_BASE=/github\\.io$/.test(location.hostname)?"../detail/":"detail/";\n'
blk='<!--DETAILMAP--><script>\n'+dm+BASE+'</script><!--/DETAILMAP-->\n'
def put(s):
    if '<!--DETAILMAP-->' in s: return re.sub(r'<!--DETAILMAP-->.*?<!--/DETAILMAP-->\n',lambda m:blk,s,flags=re.S)
    assert s.count('</body>')==1; return s.replace('</body>',blk+'</body>')
p=sys.argv[2];s=open(p).read()
if 'data-act="around"' not in s:
    s=s.replace("'<div class=\"acts\">'+","'<div class=\"acts\">'+(d.ll?'<button class=\"btn\" data-act=\"around\"><svg viewBox=\"0 0 24 24\"><circle cx=\"11\" cy=\"11\" r=\"6\"/><path d=\"M20 20l-4.5-4.5\"/></svg>まわりの地図</button>':\"\")+",1)
    k='  else if(a==="map"){'; assert s.count(k)==1
    s=s.replace(k,'  else if(a==="around"){DetailMap.open(byId[id],{base:DM_BASE,spots:D,here:here,onSpot:i=>openSpot(i)})}\n'+k)
open(p,'w').write(put(s))
p=sys.argv[3];s=open(p).read()
if 'data-around=' not in s:
    k='<button type="button" data-ledger="${d.id}">台帳で見る</button>'; assert s.count(k)==1
    s=s.replace(k,k+'<button type="button" data-around="${d.id}">まわりの地図</button>')
    s=s.replace('</body>','<script>document.addEventListener("click",e=>{const b=e.target.closest("[data-around]");if(b)DetailMap.open(byId[b.dataset.around],{base:DM_BASE,spots:D,onSpot:id=>{if(sel!==id)pick(id)}})});</script>\n</body>')
open(p,'w').write(put(s))
print("ok")
