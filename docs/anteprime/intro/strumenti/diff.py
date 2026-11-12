#!/usr/bin/env python3
# diff.py A.png B.png [OUT.png] — differences between two pictures, in levels 0..255 per channel
import sys
import numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(int)
b = np.asarray(Image.open(sys.argv[2]).convert("RGB")).astype(int)
if a.shape != b.shape:
    print("SIZE", a.shape, b.shape); sys.exit(1)
d = np.abs(a - b).max(axis=2)
n = d.size
print("px", n, "max", int(d.max()), "mean %.4f" % d.mean(), "p99.9", int(np.percentile(d, 99.9)), ">2:", int((d > 2).sum()), ">8:", int((d > 8).sum()), ">24:", int((d > 24).sum()))
if len(sys.argv) > 3:
    v = np.clip(d * 8, 0, 255).astype(np.uint8)
    Image.fromarray(v).save(sys.argv[3])
