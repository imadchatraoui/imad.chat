"""Scarica i risultati Higgsfield elencati in scripts/media/jobs.json, li converte e li mette in public/media.

Uso: python3 -I scripts/media/import.py [--cache DIR] [--force]
- immagini -> JPEG (texture, città, hero) o PNG (bande, ornamenti) ridimensionati con Pillow
- SVG -> ripuliti da script e attributi on*
- audio -> MP3 (ffmpeg)
- video -> MP4 H.264 senza audio, faststart (ffmpeg)
Alla fine riscrive public/media/manifest.json con l'elenco dei file presenti.
"""
import json, os, re, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MEDIA = os.path.join(ROOT, "public", "media")
JOBS = os.path.join(ROOT, "scripts", "media", "jobs.json")
args = sys.argv[1:]
CACHE = args[args.index("--cache") + 1] if "--cache" in args else os.path.join(ROOT, ".media-cache")
FORCE = "--force" in args

CITY = {"TORINO": "torino", "ALQUDS": "al-quds", "GAZA": "gaza", "BATTIR": "battir", "FES": "fes",
        "ISTANBUL": "istanbul", "SAMARCANDA": "samarcanda", "KYOTO": "kyoto", "CUSCO": "cusco",
        "NOTTE": "notte", "OLIVA": "oliva"}

def target_for(job):
    if job.get("target"):
        return job["target"]
    i = job["id"]
    m = re.fullmatch(r"T0(\d)", i)
    if m: return f"tex/{i}.jpg"
    m = re.fullmatch(r"O0(\d)([SP])", i)
    if m: return f"orn/{i}.{'svg' if m.group(2) == 'S' else 'png'}"
    m = re.fullmatch(r"B-([A-Z]+)", i)
    if m: return f"band/{CITY[m.group(1)]}.png"
    m = re.fullmatch(r"([ND])-([A-Z]+)-([VH])", i)
    if m: return f"city/{CITY[m.group(2)]}-{'night' if m.group(1) == 'N' else 'day'}-{m.group(3).lower()}.jpg"
    m = re.fullmatch(r"L(D?)-([A-Z]+)-([VH])", i)
    if m: return f"city/{CITY[m.group(2)]}-{'day' if m.group(1) else 'night'}-{m.group(3).lower()}.mp4"
    m = re.fullmatch(r"H0(\d)", i)
    if m: return f"hero/{i}.jpg"
    m = re.fullmatch(r"S(\d\d)", i)
    if m: return f"sfx/{i}.mp3"
    m = re.fullmatch(r"A-([A-Z]+)", i)
    if m: return f"amb/{CITY[m.group(1)]}.mp3"
    m = re.fullmatch(r"V-TARIQ-([VH])", i)
    if m: return f"video/tariq-{m.group(1).lower()}.mp4"
    raise ValueError(f"nessuna destinazione per {i}")

def download(url, dst):
    if os.path.exists(dst) and not FORCE:
        return
    req = urllib.request.Request(url, headers={"User-Agent": "imad.chat-media-import/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dst + ".part", "wb") as f:
        f.write(r.read())
    os.replace(dst + ".part", dst)

def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

def convert(src, out, kind):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    ext = os.path.splitext(out)[1]
    if ext == ".svg":
        svg = open(src, encoding="utf-8", errors="replace").read()
        svg = re.sub(r"<script[\s\S]*?</script>", "", svg, flags=re.I)
        svg = re.sub(r"\son\w+\s*=\s*(\"[^\"]*\"|'[^']*')", "", svg, flags=re.I)
        open(out, "w", encoding="utf-8").write(svg)
    elif ext in (".jpg", ".png"):
        from PIL import Image
        im = Image.open(src)
        # le texture dell'ottone si ripetono in tessere di un terzo della faccia: 1024 px bastano e pesano un quarto
        limit = 1024 if out.split(os.sep)[-2] == "tex" else 2048
        im.thumbnail((limit, limit))
        if ext == ".jpg":
            im.convert("RGB").save(out, quality=86, optimize=True, progressive=True)
        else:
            im.convert("L" if out.split(os.sep)[-2] == "band" else "RGBA").save(out, optimize=True)
    elif ext == ".mp3":
        loop = os.path.basename(out).startswith(("S03",)) or out.split(os.sep)[-2] == "amb"
        if loop:
            # Ambienti e suoni in loop: durata intatta, volume uniforme e basso.
            chain = "loudnorm=I=-24:TP=-2:LRA=11"
        else:
            # Effetti brevi: via il silenzio prima e dopo, picco a -1 dBFS, micro dissolvenze.
            trim = ("silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.01,"
                    "areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse")
            probe = subprocess.run(["ffmpeg", "-v", "info", "-i", src, "-af", trim + ",volumedetect", "-f", "null", "-"],
                                   capture_output=True, text=True).stderr
            m = re.search(r"max_volume:\s*(-?[\d.]+) dB", probe)
            gain = (-1.0 - float(m.group(1))) if m else 0.0
            chain = f"{trim},volume={gain:.2f}dB,afade=t=in:d=0.005"
        run(["ffmpeg", "-y", "-v", "error", "-i", src, "-af", chain, "-ac", "2", "-ar", "44100",
             "-codec:a", "libmp3lame", "-q:a", "3", out])
    elif ext == ".mp4":
        run(["ffmpeg", "-y", "-v", "error", "-i", src, "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "24",
             "-pix_fmt", "yuv420p", "-movflags", "+faststart", out])
    else:
        raise ValueError(out)

def main():
    data = json.load(open(JOBS))
    os.makedirs(CACHE, exist_ok=True)
    done = []
    for job in data["jobs"]:
        if not job.get("url"):
            continue
        rel = target_for(job)
        out = os.path.join(MEDIA, rel)
        if os.path.exists(out) and not FORCE and not job.get("provisional_replaced"):
            done.append(rel); continue
        src_ext = os.path.splitext(job["url"].split("?")[0])[1] or ".bin"
        # la cache è per lavoro (job), non per asset: se un asset viene rifatto, si riscarica
        src = os.path.join(CACHE, f"{job.get('job') or job['id']}{src_ext}")
        download(job["url"], src)
        convert(src, out, job["kind"])
        done.append(rel)
        print(f"{job['id']:>12} -> public/media/{rel}")
    files = []
    for base, _, names in os.walk(MEDIA):
        for n in names:
            if n == "manifest.json":
                continue
            files.append(os.path.relpath(os.path.join(base, n), MEDIA).replace(os.sep, "/"))
    os.makedirs(MEDIA, exist_ok=True)
    json.dump({"files": sorted(files)}, open(os.path.join(MEDIA, "manifest.json"), "w"), indent=1)
    print(f"manifest: {len(files)} file")

if __name__ == "__main__":
    main()
