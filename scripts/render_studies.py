"""Render the studio studies. Requires Python, Pillow, Playwright Chromium and FFmpeg."""
import argparse
import base64
import io
import json
import math
import random
import subprocess
import tempfile
import wave
from array import array
from pathlib import Path

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1] / "motion"
FPS = 24
SECONDS = 8


def offbeat_score(path):
    """Original half-second bass pulses and syncopated rim clicks."""
    rate = 44100
    samples = array("h")
    noise = random.Random(19)
    for i in range(rate * SECONDS):
        t = i / rate
        beat = int(t * 2)
        local = t - beat / 2
        kick = .36 * math.exp(-local * 17) * math.sin(2 * math.pi * (48 * local + 2 * (1 - math.exp(-local * 30))))
        click = (t + .25) % .5
        rim = .14 * math.exp(-click * 83) * (noise.uniform(-1, 1) + math.sin(2 * math.pi * 740 * click))
        note = (130.81, 164.81, 196, 146.83)[beat // 4]
        tone = .09 * math.exp(-local * 9) * math.sin(2 * math.pi * note * local)
        fade = min(1, t * 100, (SECONDS - t) * 12)
        samples.append(round(32767 * fade * (kick + rim + tone)))
    with wave.open(str(path), "wb") as out:
        out.setparams((1, 2, rate, 0, "NONE", "not compressed"))
        out.writeframes(samples.tobytes())


def render(browser, film):
    slug = film["id"]
    out = ROOT / "previews"
    out.mkdir(exist_ok=True)
    script = (ROOT / "scenes/stage.js").read_text(encoding="utf-8") + "\n"
    script += (ROOT / f"scenes/{slug}.js").read_text(encoding="utf-8")
    images = {}
    for name, filename in film["photos"].items():
        mime = "image/webp" if filename.endswith(".webp") else "image/jpeg"
        raw = (ROOT / "assets" / filename).read_bytes()
        images[name] = f"data:{mime};base64," + base64.b64encode(raw).decode()
    page = browser.new_page()
    page.set_content('<canvas width="960" height="540"></canvas>')
    page.add_script_tag(content=script)
    page.evaluate("""async sources => {
        window.photos={};
        await Promise.all(Object.entries(sources).map(async ([name,url])=>{
          const img=new Image();img.src=url;await img.decode();window.photos[name]=img;
        }));
    }""", images)
    def frame(t):
        data = page.evaluate("""t=>{
          const canvas=document.querySelector('canvas'),c=canvas.getContext('2d');
          c.save();drawFilm(c,t,window.photos);c.restore();
          return canvas.toDataURL('image/jpeg',.94).split(',')[1];
        }""", t)
        return base64.b64decode(data)
    with subprocess.Popen(["ffmpeg","-nostdin","-y","-v","error","-f","image2pipe","-framerate",str(FPS),
                           "-c:v","mjpeg","-i","pipe:0","-c:v","libx264","-crf","19","-preset","fast",
                           "-pix_fmt","yuv420p","-movflags","+faststart",str(out / f"{slug}.mp4")],
                          stdin=subprocess.PIPE) as proc:
        for n in range(FPS*SECONDS):
            proc.stdin.write(frame(n/FPS))
        proc.stdin.close()
        if proc.wait(): raise RuntimeError(f"Encoding failed for {slug}")
    if slug == "offbeat":
        with tempfile.TemporaryDirectory(dir=out) as scratch:
            audio = Path(scratch) / "score.wav"
            mixed = Path(scratch) / "mix.mp4"
            offbeat_score(audio)
            subprocess.run(["ffmpeg","-v","error","-i",str(out / f"{slug}.mp4"),"-i",str(audio),
                            "-c:v","copy","-c:a","aac","-movflags","+faststart","-shortest",str(mixed)],check=True)
            mixed.replace(out / f"{slug}.mp4")
    for t, suffix in [(1.65,"poster"),(4.45,"detail"),(7.12,"end")]:
        im=Image.open(io.BytesIO(frame(t))).convert("RGB")
        if suffix=="poster":
            im.save(out / f"{slug}.webp",quality=90)
            sheet=Image.new("RGB",(1440,310),"#ede9df")
        idx={"poster":0,"detail":1,"end":2}[suffix]
        sheet.paste(im.resize((480,270),Image.Resampling.LANCZOS),(idx*480,0))
        ImageDraw.Draw(sheet).text((idx*480+12,280),f"{t:.2f}s   {film['title']}",fill="#20211e")
    sheet.save(out / f"{slug}-frames.jpg",quality=90)
    page.close()
    print("Rendered",slug,flush=True)


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("film",nargs="*")
    ids=parser.parse_args().film
    with sync_playwright() as pw:
        browser=pw.chromium.launch()
        for item in json.loads((ROOT / "films.json").read_text(encoding="utf-8")):
            if not ids or item["id"] in ids: render(browser,item)
        browser.close()
