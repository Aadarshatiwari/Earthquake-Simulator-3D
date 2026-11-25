#!/usr/bin/env python3
"""Resample AWS Terrarium z7 tiles, converted losslessly to RGB BMP with sips."""
import json
import math
import struct
import sys
from functools import lru_cache
from pathlib import Path

tile_dir = Path(sys.argv[1])
target = Path(sys.argv[2])
west, south, step, width, height = 79.9, 26.15, 0.035, 247, 126

@lru_cache
def tile(x, y):
    blob = (tile_dir / f'{x}-{y}.bmp').read_bytes()
    start, w, h, planes, bits = struct.unpack_from('<I4xiiHH', blob, 10)
    if (w, abs(h), planes, bits) != (256, 256, 1, 24):
        raise ValueError('Expected 256 × 256 RGB BMP')
    return blob, start, h

def elevation(lon, lat):
    edge = 128 * 256
    gx = int((lon + 180) / 360 * edge)
    gy = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * edge)
    blob, start, h = tile(gx // 256, gy // 256)
    row = gy % 256 if h < 0 else 255 - gy % 256
    pos = start + (row * 256 + gx % 256) * 3
    blue, green, red = blob[pos:pos + 3]
    return round(red * 256 + green + blue / 256 - 32768)

values = [elevation(west + x * step, south + y * step)
          for y in range(height) for x in range(width)]
target.write_text(json.dumps(dict(w=width, h=height, west=west, south=south,
                                  step=step, elevations=values), separators=(',', ':')))
print(f'{len(values)} samples, {min(values)} to {max(values)} metres')
