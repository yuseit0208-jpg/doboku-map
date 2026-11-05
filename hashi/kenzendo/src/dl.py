import json, gzip, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
B="https://road-structures-db.mlit.go.jp/xROAD/api/v1/bridges"
OUT="raw"
counts=dict(x.split(':') for x in sys.argv[1].split())
jobs=[]
for p,c in counts.items():
    for off in range(0,int(c),5000): jobs.append((p,off))
def get(job):
    p,off=job; fn=f"{OUT}/{p}_{off:06d}.json.gz"
    if os.path.exists(fn): return
    for i in range(6):
        try:
            with urllib.request.urlopen(f"{B}?pref={p}&limit=5000&offset={off}",timeout=300) as r: b=r.read()
            d=json.loads(b); assert not d['resultset']['is_error']
            with gzip.open(fn+'.tmp','wb') as f: f.write(b)
            os.rename(fn+'.tmp',fn); print(p,off,len(d['result']),flush=True); return
        except Exception as e:
            print('ERR',p,off,e,flush=True); time.sleep(5*2**i)
with ThreadPoolExecutor(5) as ex: list(ex.map(get,jobs))
print('DONE',len(jobs))
