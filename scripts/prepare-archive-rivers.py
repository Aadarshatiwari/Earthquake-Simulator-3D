#!/usr/bin/env python3
"""Extract Natural Earth river or GEM fault line vertices in the relief footprint."""
import json
import sys
from pathlib import Path

source, destination = map(Path, sys.argv[1:3])
faults = sys.argv[3:] == ['--faults']
features = []
for feature in json.loads(source.read_text())['features']:
    geometry = feature['geometry']
    if geometry['type'] not in ('LineString', 'MultiLineString'):
        continue
    properties = feature['properties']
    attributes = ({key: properties.get(key) for key in ('name', 'catalog_name', 'catalog_id', 'slip_type')}
                  if faults else {'name': properties.get('name_en')})
    paths = geometry['coordinates']
    if geometry['type'] == 'LineString':
        paths = [paths]
    for path in paths:
        segment = []
        for lon, lat, *_ in [*path, (0, 0)]:
            if 79.9 <= lon <= 88.51 and 26.15 <= lat <= 30.525:
                segment.append([round(lon, 4), round(lat, 4)])
                continue
            if len(segment) > 1:
                features.append(dict(
                    type='Feature', properties=attributes,
                    geometry=dict(type='LineString', coordinates=segment)))
            segment = []
destination.write_text(json.dumps(dict(type='FeatureCollection', features=features),
                                  separators=(',', ':')))
