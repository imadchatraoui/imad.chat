import sys, glob
from PIL import Image, ImageDraw
pref, out, cols, tw = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
files = sorted(glob.glob(pref + "-*.png"))
ims = [Image.open(f).convert("RGB") for f in files]
th = round(ims[0].height * tw / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (tw + 6) + 6, rows * (th + 22) + 6), (30, 30, 34))
d = ImageDraw.Draw(sheet)
for k, (f, im) in enumerate(zip(files, ims)):
    x = 6 + (k % cols) * (tw + 6); y = 6 + (k // cols) * (th + 22)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y)); d.text((x + 2, y + th + 4), f.split("-")[-1].replace(".png", "") + " ms", fill=(235, 235, 235))
sheet.save(out, quality=84); print(out, sheet.size)
