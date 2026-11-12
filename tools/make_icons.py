"""Draw the app icon (calendar page with a check mark) at 180/192/512 px."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
OUT.mkdir(exist_ok=True)
BLUE = (47, 91, 234)
WHITE = (255, 255, 255)
S = 2048  # draw large, then downscale for smooth edges

img = Image.new("RGB", (S, S), BLUE)
d = ImageDraw.Draw(img)
# page
x0, y0, x1, y1 = int(S * 0.22), int(S * 0.27), int(S * 0.78), int(S * 0.80)
d.rounded_rectangle((x0, y0, x1, y1), radius=int(S * 0.08), fill=WHITE)
# header band
d.rounded_rectangle((x0, y0, x1, y0 + int(S * 0.14)), radius=int(S * 0.08), fill=(222, 230, 253))
d.rectangle((x0, y0 + int(S * 0.08), x1, y0 + int(S * 0.14)), fill=(222, 230, 253))
# rings
for cx in (0.37, 0.63):
    rx = int(S * cx)
    d.rounded_rectangle((rx - int(S * 0.025), int(S * 0.20), rx + int(S * 0.025), int(S * 0.33)), radius=int(S * 0.025), fill=WHITE)
# check mark
w = int(S * 0.065)
pts = [(int(S * 0.36), int(S * 0.57)), (int(S * 0.47), int(S * 0.68)), (int(S * 0.66), int(S * 0.47))]
d.line(pts, fill=BLUE, width=w, joint="curve")
for p in (pts[0], pts[2]):
    d.ellipse((p[0] - w // 2, p[1] - w // 2, p[0] + w // 2, p[1] + w // 2), fill=BLUE)

for size in (180, 192, 512):
    img.resize((size, size), Image.LANCZOS).save(OUT / f"icon-{size}.png", optimize=True)
print("icons written to", OUT)
