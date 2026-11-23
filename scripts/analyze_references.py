"""Measure timing and colors from local reference clips, with FFmpeg and no model calls."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "motion/remake-profiles.json"


def colors(frames):
    bins = Counter()
    for frame in frames:
        for r, g, b in zip(frame[::3], frame[1::3], frame[2::3]):
            bins[(r//32, g//32, b//32)] += 1
    common = [tuple(v*32+16 for v in key) for key, count in bins.most_common(24)]
    bg = common[0]
    candidates = [c for c in common if sum(abs(a-b) for a,b in zip(bg,c)) > 125]
    accent = max(candidates, key=lambda c: max(c)-min(c)) if candidates else ((240,240,240) if sum(bg)<384 else (16,16,16))
    return ["#%02x%02x%02x" % c for c in (bg, accent)]


def analyze(task):
    row, media, folder = task
    duration = media["seconds"]
    rate = min(2, 240 / duration)
    raw = subprocess.check_output(["ffmpeg","-v","error","-threads","2","-i",str(folder / media["file"]),
        "-an","-vf",f"fps={rate:.7f},scale=32:18","-pix_fmt","rgb24","-threads","1","-f","rawvideo","pipe:1"])
    size = 32*18*3
    frames = [raw[i:i+size] for i in range(0,len(raw),size)]
    if not frames: raise ValueError("No samples for "+row["id"])
    differences = [(sum(abs(x-y) for x,y in zip(a,b))/size,i)
                   for i,(a,b) in enumerate(zip(frames,frames[1:]),1)]
    threshold = max(20,2.4*median([v for v,i in differences] or [0]))
    cuts = [0]
    for change,i in sorted(differences,reverse=True):
        if len(cuts)>=12 or change<threshold: break
        if duration-i/rate>=1.1 and all(abs(i-old)/rate>=1.1 for old in cuts): cuts.append(i)
    cuts.sort()
    beats = []
    for a,b in zip(cuts,cuts[1:]+[len(frames)]):
        bg,accent = colors(frames[a:b])
        beats.append(dict(start=round(a/rate,3),background=bg,accent=accent))
    return row["id"], dict(seconds=duration,width=media["width"],height=media["height"],beats=beats)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--folder",type=Path,default=ROOT/"downloads/x")
    p.add_argument("--output",type=Path,default=OUTPUT)
    args=p.parse_args()
    entries=json.loads((args.folder/"manifest.json").read_text(encoding="utf8"))["entries"]
    jobs=[]
    for row in entries:
        media=next((m for m in row["media"] if m["status"]=="downloaded"),None)
        if media: jobs.append((row,media,args.folder))
    # Keep already measured profiles when running against a partial local collection.
    profiles=json.loads(args.output.read_text(encoding="utf8")) if args.output.exists() else {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        profiles.update(pool.map(analyze,jobs))
    temp=args.output.with_suffix(".tmp")
    temp.write_text(json.dumps(profiles,sort_keys=True,separators=(",",":"))+"\n",encoding="utf8")
    temp.replace(args.output)
    print(f"Measured {len(jobs)} clips. {len(profiles)} profiles in {args.output}.")


if __name__=="__main__": main()
