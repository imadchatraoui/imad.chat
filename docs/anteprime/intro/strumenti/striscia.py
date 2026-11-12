"""Mette in un foglio i fotogrammi di una cartella (f-NNN_tT.png), con l'istante (ms) sotto ognuno.
Uso: python3 striscia.py <cartella> <uscita.jpg> <colonne> <larghezza di un fotogramma in px>"""
import sys, glob, os
from PIL import Image, ImageDraw
d, out, cols, tw = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
files = sorted(glob.glob(os.path.join(d, "f-*.png")))
ims = [Image.open(f).convert("RGB") for f in files]
th = round(ims[0].height * tw / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (tw + 4) + 4, rows * (th + 18) + 4), (40, 40, 46))
dr = ImageDraw.Draw(sheet)
for k, (f, im) in enumerate(zip(files, ims)):
    x = 4 + (k % cols) * (tw + 4); y = 4 + (k // cols) * (th + 18)
    sheet.paste(im if im.width == tw else im.resize((tw, th), Image.LANCZOS), (x, y))
    dr.text((x + 3, y + th + 3), os.path.basename(f).split("_t")[-1].replace(".png", "") + " ms", fill=(230, 230, 230))
sheet.save(out, quality=86)
print(out, sheet.size)
