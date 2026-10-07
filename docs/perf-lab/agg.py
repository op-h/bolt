import json,sys,statistics as st,collections
d=collections.defaultdict(list)
for l in open(sys.argv[1]):
    if l.startswith('{'):
        j=json.loads(l)
        if j['n']: d[j['variant']].append(j)
def m(x):
    x=[v for v in x if v is not None]
    return round(st.median(x),0) if x else None
print('%-13s %2s %6s %6s %6s %6s %5s %5s %7s %6s  conn'%('variant','n','fcp','lcp','ready','load','ltN','ltMax','cls','wireKB'))
for v,js in d.items():
    print('%-13s %2d %6s %6s %6s %6s %5s %5s %7.4f  %s | lcp-runs %s'%(v,len(js),m([j['fcp'] for j in js]),m([j['lcp'] for j in js]),m([j['ready'] for j in js]),m([j['load'] for j in js]),m([j['bootLT_n'] for j in js]),m([j['bootLT_max'] for j in js]),st.median([j['clsBoot'] for j in js]),js[0].get('conn'),[int(j['lcp']) for j in js]))
