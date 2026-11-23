"""Save download-enabled X videos for the studio reference index. Requires ffprobe on PATH."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
import datetime
import http.client
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "motion/reference-index.json"
DEFAULT = ROOT / "downloads/x"
UA = "Mozilla/5.0 (compatible; DesignerVideoStudio/1.0; +https://github.com/maan-iitd2/designer-video-studio)"
POST = re.compile(r"https://(?:www\.)?(?:x|twitter)\.com/[\w]+/status/(\d+)/?$")


@contextmanager
def lock_folder(folder):
    with (folder / ".download.lock").open("a+b") as lock:
        lock.seek(0)
        if os.name == "nt":
            import msvcrt
            if not lock.read(1):
                lock.write(b"1")
                lock.flush()
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def request(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30)


def retry(fn):
    for attempt in range(3):
        try:
            return fn()
        except urllib.error.HTTPError as e:
            if attempt == 2 or e.code not in (429, 500, 502, 503, 504):
                raise
            delay = int(e.headers.get("Retry-After", "0")) if e.headers.get("Retry-After", "").isdigit() else 0
            if delay > 60:
                raise
            time.sleep(max(delay, 2 ** attempt))
        except (OSError, EOFError, http.client.HTTPException):
            if attempt == 2: raise
            time.sleep(2 ** attempt)


def public_media(post):
    match = POST.fullmatch(post)
    if not match: raise ValueError("Invalid indexed post URL")
    post_id = match.group(1)
    with request(post) as response:
        page = response.read().decode("utf-8")
    decoder = json.JSONDecoder()
    own = {}
    # The public post may contain a JSON object directly or inside streamed JSON strings.
    for depth in range(5):
        for start in re.finditer(r'"media_entities2"\s*:\s*(?=\[)', page):
            try: entities, _ = decoder.raw_decode(page[start.end():])
            except ValueError: continue
            for item in entities:
                origin = item.get("expanded_url", "")
                if not re.search(r"/status/"+post_id+r"/(?:video|photo)/\d+",origin): continue
                if item.get("type") not in ("video","animated_gif"): continue
                own[item.get("id_str") or origin] = item
        if own: break
        expanded = page.replace(r'\"','"').replace('\\\\','\\')
        if expanded == page: break
        page = expanded
    return list(own.values())


def video_info(path):
    probe = subprocess.run(["ffprobe","-v","error","-select_streams","v:0","-show_entries",
                            "stream=codec_name,width,height:format=duration","-of","json",str(path)],
                           capture_output=True, text=True, timeout=30, check=True)
    data = json.loads(probe.stdout)
    stream = data["streams"][0]
    duration = float(data["format"]["duration"])
    if duration <= 0 or not stream["width"] or not stream["height"]: raise ValueError("Invalid video")
    return dict(seconds=round(duration,3),width=stream["width"],height=stream["height"],bytes=path.stat().st_size)


def save_media(url, dest, expected_ms):
    if urlsplit(url).scheme != "https" or urlsplit(url).hostname != "video.twimg.com":
        raise ValueError("Unexpected media origin")
    handle, name = tempfile.mkstemp(dir=dest.parent, suffix=".part")
    os.close(handle)
    partial = Path(name)
    try:
        with request(url) as response, partial.open("wb") as sink:
            shutil.copyfileobj(response, sink, length=256*1024)
            expected = response.headers.get("Content-Length")
        if expected and partial.stat().st_size != int(expected): raise EOFError("Incomplete response")
        info = video_info(partial)
        if expected_ms and abs(info["seconds"] - expected_ms/1000) > 2:
            raise ValueError("Duration disagrees with the source")
        os.replace(partial, dest)
        return info
    finally:
        partial.unlink(missing_ok=True)


def download(row, folder):
    result = {key:row[key] for key in ("id","title","creator","post","url")}
    result["media"] = []
    try:
        items = retry(lambda: public_media(row["post"]))
        for number, item in enumerate(items, 1):
            entry = {"media_id":item.get("id_str"),"position":number}
            result["media"].append(entry)
            permission = (item.get("allow_download_status") or {}).get("allow_download")
            if permission is not True:
                entry["status"] = "disabled" if permission is False else "permission_unknown"
                continue
            variants = [v for v in (item.get("video_info") or {}).get("variants",[])
                        if v.get("content_type")=="video/mp4" and v.get("url")]
            if not variants:
                entry["status"] = "no_mp4"
                continue
            best = max(variants, key=lambda v:v.get("bitrate",0))
            dest = folder / (row["id"] + ("" if number==1 else "-"+str(number)) + ".mp4")
            try:
                expected_ms = (item.get("video_info") or {}).get("duration_millis")
                info = None
                if dest.is_file():
                    try:
                        prior = video_info(dest)
                        if not expected_ms or abs(prior["seconds"] - expected_ms/1000) <= 2:
                            info = prior
                    except (ValueError,KeyError,IndexError,subprocess.SubprocessError):
                        pass
                if info is None: info = retry(lambda: save_media(best["url"], dest, expected_ms))
                entry.update(status="downloaded",file=dest.name,**info)
            except (OSError, ValueError, KeyError, IndexError, EOFError, http.client.HTTPException, subprocess.SubprocessError) as e:
                entry.update(status="error",reason=str(e))
        states = {m["status"] for m in result["media"]}
        if not states: result["status"] = "no_verified_media"
        elif states=={"downloaded"}: result["status"]="downloaded"
        elif "downloaded" in states: result["status"]="partial"
        elif len(states)==1: result["status"]=next(iter(states))
        else: result["status"]="mixed_skips"
    except (OSError,ValueError,EOFError,http.client.HTTPException) as e:
        result.update(status="post_unavailable",reason=str(e))
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("ids",nargs="*",help="Reference IDs. Omit to process every indexed post.")
    p.add_argument("--output",type=Path,default=DEFAULT)
    args=p.parse_args()
    if not shutil.which("ffprobe"):p.error("Install FFmpeg (including ffprobe) first.")
    rows=json.loads(INDEX.read_text(encoding="utf-8"))["entries"]
    ids={r["id"] for r in rows}
    if set(args.ids)-ids:p.error("Unknown reference ID: "+", ".join(sorted(set(args.ids)-ids)))
    chosen=[r for r in rows if not args.ids or r["id"] in args.ids]
    args.output.mkdir(parents=True,exist_ok=True)
    with lock_folder(args.output):
        manifest=args.output/"manifest.json"
        results={r["id"]:r for r in json.loads(manifest.read_text(encoding="utf-8"))["entries"]} if manifest.exists() else {}
        def checkpoint():
            temp=manifest.with_suffix(".tmp")
            data={"updated":datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  "entries":[results[r["id"]] for r in rows if r["id"] in results]}
            temp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
            os.replace(temp,manifest)
        with ThreadPoolExecutor(max_workers=3) as pool:
            jobs=[pool.submit(download,r,args.output) for r in chosen]
            for i,job in enumerate(as_completed(jobs),1):
                result=job.result();results[result["id"]]=result;checkpoint()
                if i%20==0 or i==len(chosen):
                    print(i,"/",len(chosen),dict(Counter(r["status"] for r in results.values())),flush=True)
        print(manifest.resolve())


if __name__=="__main__":main()
