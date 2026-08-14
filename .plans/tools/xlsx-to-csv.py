import sys, zipfile, csv, re
from xml.etree import ElementTree as ET
NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
def col(ref):
    m=re.match(r'([A-Z]+)',ref); n=0
    for c in m.group(1): n=n*26+ord(c)-64
    return n-1
def conv(path,out):
    z=zipfile.ZipFile(path)
    shared=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall(f'{NS}si'):
            shared.append(''.join(t.text or '' for t in si.iter(f'{NS}t')))
    names=[n for n in z.namelist() if re.match(r'xl/worksheets/sheet\d+\.xml$',n)]
    rows=[]
    root=ET.fromstring(z.read(sorted(names)[0]))
    for r in root.iter(f'{NS}row'):
        cells={}
        for c in r.findall(f'{NS}c'):
            v=c.find(f'{NS}v'); isx=c.find(f'{NS}is')
            if c.get('t')=='s' and v is not None: val=shared[int(v.text)]
            elif c.get('t')=='inlineStr' and isx is not None: val=''.join(t.text or '' for t in isx.iter(f'{NS}t'))
            elif v is not None: val=v.text
            else: val=''
            cells[col(c.get('r'))]=val
        rows.append([cells.get(i,'') for i in range(max(cells)+1)] if cells else [])
    w=max((len(r) for r in rows), default=0)
    with open(out,'w',newline='') as f:
        cw=csv.writer(f)
        for r in rows: cw.writerow(r+['']*(w-len(r)))
    print(f"{path}: {len(rows)} rows x {w} cols -> {out}")
    return rows
r1=conv(sys.argv[1],sys.argv[2])
