"""Build the curated offline assets from verified provider downloads. See docs/archive-data.md."""
from pathlib import Path
import hashlib, json, math, sys, zipfile

source = Path(sys.argv[1])
destination = Path('public/archive')
destination.mkdir(parents=True, exist_ok=True)

def read(name):
    return json.loads((source / name).read_text())

def write(name, value):
    path = destination / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, separators=(',', ':'), ensure_ascii=False) + '\n')

def simplify(points, tolerance=.004):
    """Douglas–Peucker on open longitude/latitude coordinates."""
    if len(points) < 3:
        return points
    ax, ay = points[0]
    bx, by = points[-1]
    dx, dy = bx - ax, by - ay
    extent = dx * dx + dy * dy
    best, middle = 0, 0
    for i, (x, y) in enumerate(points[1:-1], 1):
        f = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / extent)) if extent else 0
        error = (x - ax - dx * f) ** 2 + (y - ay - dy * f) ** 2
        if error > best:
            best, middle = error, i
    if best <= tolerance ** 2:
        return [points[0], points[-1]]
    return simplify(points[:middle + 1], tolerance)[:-1] + simplify(points[middle:], tolerance)

def polygon(rings):
    output = []
    for ring in rings:
        points = simplify(ring)
        if len(points) < 4:
            points = ring
        output.append([[round(x, 5), round(y, 5)] for x, y in points])
    return output

for level in ('provinces', 'districts'):
    shapes = read(level + '.geojson')
    for feature in shapes['features']:
        geo = feature['geometry']
        properties = feature['properties']
        feature['properties'] = dict(name=properties.get('DISTRICT', properties['PR_NAME']).title().replace(' Province', ''),
                                     province=properties['PR_NAME'].replace(' Province', ''))
        geo['coordinates'] = [polygon(p) for p in geo['coordinates']] if geo['type'] == 'MultiPolygon' else polygon(geo['coordinates'])
    assert len(shapes['features']) == (7 if level == 'provinces' else 77)
    write(level + '.json', shapes)

catalog = []
for feature in read('catalog.json')['features']:
    p = feature['properties']
    catalog.append([feature['id'], p['place'], p['time'], p['mag'], p['magType'], *feature['geometry']['coordinates'], p.get('mmi')])
write('catalog.json', catalog)

archive = source / 'records.zip'
assert hashlib.md5(archive.read_bytes()).hexdigest() == '84b6e4b6257191486f53d63ce8d98d78'
manifest = []
with zipfile.ZipFile(archive) as records:
    for stamp, event in [('201504250645','us2000292y'), ('201504260709','us200029bt'), ('201505120705','us20002ejl')]:
        for path in sorted(n for n in records.namelist() if n.startswith('datasets/'+stamp+'/') and n.endswith('.txt')):
            raw = records.read(path)
            lines = raw.decode('ascii').splitlines()
            values = [line.split('\t')[-1] for line in lines[:9]]
            station = values[1]
            name = event + '-' + station + '.txt'
            target = destination / 'records' / name
            target.parent.mkdir(exist_ok=True)
            target.write_bytes(raw)
            manifest.append(dict(id=event+'-'+station,event=event,station=station,latitude=float(values[2]),longitude=float(values[3]),
                                 elevation=float(values[4]),hz=float(values[5]),start=values[7]+'Z',duration=float(values[6]),
                                 asset='records/'+name,sha256=hashlib.sha256(raw).hexdigest(),samples=len(lines)-10,path=path))
write('recordings.json',manifest)

products = {}
for event in ('us20002926','us20002ejl'):
    product = max(read(event+'.json')['properties']['products']['shakemap'],key=lambda p:p['preferredWeight'])
    for parameter in ('mmi','pga','pgv','psa0p3'):
        key = f'{event}-{parameter}'
        if (source/(key+'.json')).exists():
            write('shakemap/'+key+'.json', read(key+'.json'))
            products[key] = product['contents']['download/cont_'+parameter+'.json']['url']
write('shakemaps.json',products)
