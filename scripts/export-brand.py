"""Rasterize the geometric brand mark at store and launcher resolutions."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'public' / 'brand'
image = Image.new('RGB', (1024, 1024), '#080f1a')
draw = ImageDraw.Draw(image)

def path(points, colour, width):
    scaled = [(x * 8, y * 8) for x, y in points]
    radius = width * 4
    draw.line(scaled, fill=colour, width=width * 8, joint='curve')
    for x, y in scaled:
        draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill=colour)

draw.rounded_rectangle((40, 40, 984, 984), radius=200, outline='#33516a', width=16)
path([(20, 66), (43, 43), (54, 55), (77, 25), (105, 65)], '#edf7ff', 6)
for points in [[(74, 51), (74, 97)], [(98, 56), (98, 97)],
               [(74, 62), (98, 62)], [(74, 75), (98, 75)], [(74, 87), (98, 87)]]:
    path(points, '#3b82f6', 3)
path([(19, 83), (36, 83), (42, 72), (50, 95), (58, 64), (65, 83), (107, 83)], '#22d3ee', 4)
image.save(root / 'icon-1024.png')
image.resize((512,512), Image.Resampling.LANCZOS).save(root / 'play-store-512.png')
