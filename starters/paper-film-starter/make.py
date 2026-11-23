"""Render a storyboard, a timed excerpt or the whole film locally."""
import argparse
import functools
import io
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
from threading import Thread
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
FPS = 30


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def frame(page, seconds):
    page.evaluate("t => window.seek(t)", seconds)
    return page.screenshot(type="jpeg", quality=93)


def board(page, shots, destination):
    columns = min(3, len(shots))
    sheet = Image.new("RGB", (384 * columns, 246 * math.ceil(len(shots) / columns)), "#e2e2c4")
    labels = ImageDraw.Draw(sheet)
    for i, shot in enumerate(shots):
        t = shot["start"] + min(shot["duration"] * .88, max(shot["duration"] / 2, shot["cue"] + .65))
        still = Image.open(io.BytesIO(frame(page, t))).convert("RGB")
        x, y = (i % columns) * 384, (i // columns) * 246
        sheet.paste(still.resize((384, 216), Image.Resampling.LANCZOS), (x, y))
        labels.text((x + 7, y + 220), f'{i+1}   {t:.2f}s   {shot["layout"]}', fill="#16201f")
    sheet.save(destination, format="PNG")


def movie(page, destination, start, end, audio):
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe",
               "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "pipe:0"]
    if audio:
        command += ["-ss", str(start), "-i", str(ROOT / audio), "-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac"]
    command += ["-t", str(end-start), "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p",
                "-movflags", "+faststart", str(destination)]
    with subprocess.Popen(command, stdin=subprocess.PIPE) as encoder:
        try:
            for i in range(math.ceil((end-start)*FPS-1e-8)):
                encoder.stdin.write(frame(page, start+i/FPS))
        finally:
            encoder.stdin.close()
        if encoder.wait():
            raise RuntimeError("FFmpeg failed")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["board", "clip", "render"])
    parser.add_argument("--start", type=float, default=0)
    parser.add_argument("--end", type=float)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    project = json.loads((ROOT / "shots.json").read_text(encoding="utf-8-sig"))
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            width, height = (960, 540) if args.mode == "clip" else (1920, 1080)
            page = browser.new_page(viewport={"width":width,"height":height})
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"http://127.0.0.1:{server.server_port}/index.html?export")
            page.wait_for_function("window.ready || window.filmError", timeout=120000)
            failure = page.evaluate("window.filmError")
            if failure: raise RuntimeError(failure)
            duration = page.evaluate("window.duration")
            start = args.start if args.mode == "clip" else 0
            end = args.end if args.mode == "clip" and args.end is not None else duration
            if not (0 <= start < end <= duration + .00001):
                raise ValueError("Choose an interval within the film.")
            suffix = ".png" if args.mode == "board" else ".mp4"
            dest = args.output or ROOT / (args.mode + suffix)
            if dest.suffix.lower() != suffix: raise ValueError("Expected " + suffix)
            dest.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.TemporaryDirectory(dir=dest.parent) as tmp:
                path = Path(tmp) / ("export" + suffix)
                if args.mode == "board": board(page, project["shots"], path)
                else: movie(page, path, start, end, project.get("audio"))
                if errors: raise RuntimeError("; ".join(errors))
                os.replace(path, dest)
            print(dest)
        server.shutdown()


if __name__ == "__main__":
    main()

