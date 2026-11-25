#!/usr/bin/env python3
"""Package checked Takai et al. 2016 supplements and original station headers."""
import hashlib
import json
import re
import sys
from pathlib import Path

root, output = map(Path, sys.argv[1:3])
entries = []
for article_id in (4375088, 4375112, 4375067, 4375040):
    article = json.loads((root / f'{article_id}.json').read_text())
    assert article['license']['name'] == 'CC BY 4.0'
    file, = article['files']
    data = (root / file['name']).read_bytes()
    assert hashlib.md5(data).hexdigest() == file['computed_md5']
    content = data.decode('ascii')
    def header(name):
        return re.search(r'^# ' + re.escape(name) + r'\s+([^\r\n]+)', content, re.MULTILINE)[1].strip()
    station = header('Station CODE')
    time = header('First sample is at').replace(' (UTC)', '').replace(' ', 'T')
    assert time.startswith('2015-04-25T06:11:')
    samples = sum(1 for row in content.splitlines() if row.strip() and not row.startswith('#'))
    hz = int(header('Sampling Freq(Hz)'))
    duration = int(header('Duration Time(s)'))
    assert hz * duration == samples
    asset = f'records/us20002926-{station}.dat'
    (output / asset).write_bytes(data)
    entries.append(dict(id=f'us20002926-{station}',event='us20002926',station=station,
                        latitude=float(header('Station Lat.')[1:]),longitude=float(header('Station Long.')[1:]),
                        elevation=int(header('Station Height(m)')),hz=hz,start=time+'Z',duration=duration,
                        asset=asset,sha256=hashlib.sha256(data).hexdigest(),samples=samples,path=file['name'],
                        format='Takai2016',source='https://doi.org/'+article['doi']))
(output / 'gorkha-mainshock.json').write_text(json.dumps(entries,separators=(',',':')))
