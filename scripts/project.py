"""Compile an unpacked Studio edit.json into a HyperFrames timeline. Python 3.9+."""
import argparse
from html import escape
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

GSAP = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"
VERSION = "0.9.84"


def color(value):
    if not re.fullmatch(r"#[0-9a-fA-F]{6}",value): raise ValueError("Expected a six-digit hex color")
    return value


def number(value, positive=False):
    v=float(value)
    if not math.isfinite(v) or v<0 or (positive and v==0): raise ValueError("Invalid time or size")
    return v


def asset_url(value):
    path=Path(value)
    if path.is_absolute() or ".." in path.parts or ":" in value or "\\" in value:
        raise ValueError("Use a relative asset path inside the project")
    return escape(path.as_posix(),quote=True)


def compile_edit(edit):
    width,height=[int(number(edit[key],True)) for key in ("width","height")]
    layers=[]
    start=0
    if not edit["shots"]: raise ValueError("Add at least one shot")
    for i,shot in enumerate(edit["shots"],1):
        length=number(shot["seconds"],True)
        timing=f'data-start="{start:.3f}" data-duration="{length:.3f}" data-track-index="0"'
        if shot.get("media"):
            src=asset_url(shot["media"])
            if Path(shot["media"]).suffix.lower() in (".mp4",".webm",".mov"):
                trim=number(shot.get("source_start",0))
                sound='data-has-audio="true"' if shot.get("media_has_audio") else "muted"
                layer=f'<video id="shot-{i}" class="clip media" {timing} data-media-start="{trim:.3f}" src="{src}" {sound} playsinline></video>'
            else:
                layer=f'<img id="shot-{i}" class="clip media" {timing} src="{src}" alt="">'
        else:
            component=shot["component"]
            if not re.fullmatch(r"[a-z0-9-]+",component): raise ValueError("Invalid component name")
            # Each mount has its own runtime timeline, including repeated uses of a component.
            name=f"{component}-shot-{i}"
            bg,accent=[color(shot[key]) for key in ("background","accent")]
            rgb=[int(bg[n:n+2],16) for n in (1,3,5)]
            light=sum(c*w for c,w in zip(rgb,(.2126,.7152,.0722)))>142
            fg,muted,surface,border=("#171716","#4d4a46","#f1eee9","#c3beb8") if light else ("#faf8f4","#b7b5b1","#232426","#515255")
            style=f"background:{bg};--bg:{bg};--fg:{fg};--brand:{accent};--accent:{accent};--accent-2:{accent};--muted:{muted};--surface:{surface};--border:{border}"
            values=escape(json.dumps(shot["variables"],ensure_ascii=False),quote=True)
            layer=(f'<div id="mount-{i}" class="clip mount" {timing} style="{style}" data-composition-id="{name}" '
                   f'data-composition-src="instances/{name}.html" data-variable-values="{values}" '
                   f'data-width="{width}" data-height="{height}"></div>')
        layers.append(layer)
        start=round(start+length,3)
    if edit.get("audio"):
        layers.append(f'<audio id="soundtrack" class="clip" src="{asset_url(edit["audio"])}" data-start="0" data-duration="{start}" data-track-index="1"></audio>')
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{escape(edit["title"])}</title>
<style>*{{box-sizing:border-box}}html,body,#film{{margin:0;width:{width}px;height:{height}px;overflow:hidden;background:#141414}}
#film{{position:relative;font-family:Arial,sans-serif}}.mount,.media{{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;container-type:size}}.media{{object-fit:contain}}</style></head><body>
<div id="film" data-composition-id="studio-film" data-width="{width}" data-height="{height}" data-start="0" data-duration="{start}" data-fps="30">
{chr(10).join(layers)}</div><script src="{GSAP}"></script>
<script>window.__timelines=window.__timelines||{{}};window.__timelines["studio-film"]=gsap.timeline({{paused:true}});</script></body></html>"""


def assembled(edit,read_component):
    files={"index.html":compile_edit(edit)}
    for i,shot in enumerate(edit["shots"],1):
        if shot.get("media"): continue
        component=shot["component"]
        name=f"{component}-shot-{i}"
        source=read_component(component).replace(component,name)
        files[f"instances/{name}.html"]=source.replace("__STUDIO_SHOT_SECONDS__",str(number(shot["seconds"],True)))
    return files


def render_footage(edit, root):
    """Fast path for a cut of one MP4. Mixed compositions use HyperFrames."""
    shots=edit["shots"]
    sources={s.get("media") for s in shots}
    if edit.get("audio") or len(sources)!=1 or not all(sources): return False
    source=root/next(iter(sources))
    if source.suffix.lower()!=".mp4" or not all(shutil.which(t) for t in ("ffmpeg","ffprobe")): return False
    output=root/"film.mp4"
    if source.resolve()==output.resolve(): raise ValueError("Move the source MP4 into assets/ before rendering.")
    result=subprocess.run(["ffprobe","-v","error","-of","json","-show_entries",
        "stream=codec_type,width,height:format=duration",str(source)],capture_output=True,text=True,check=True)
    probe=json.loads(result.stdout)
    video=next(s for s in probe["streams"] if s["codec_type"]=="video")
    if (video["width"],video["height"])!=(edit["width"],edit["height"]): return False
    sound={bool(s.get("media_has_audio")) for s in shots}
    if len(sound)!=1: return False
    has_audio=any(s["codec_type"]=="audio" for s in probe["streams"])
    with_audio=sound.pop()
    if with_audio and not has_audio: raise ValueError("This MP4 has no audio track. Clear Include video’s own audio.")
    length=float(probe["format"]["duration"])
    elapsed=0
    continuous=True
    graph=[]
    joins=[]
    for i,shot in enumerate(shots):
        start=number(shot.get("source_start",0));seconds=number(shot["seconds"],True)
        if start+seconds>length+.04: return False
        continuous=continuous and abs(start-elapsed)<.0011
        elapsed+=seconds
        graph.append(f"[0:v]trim=start={start}:duration={seconds},setpts=PTS-STARTPTS[v{i}]")
        joins.append(f"[v{i}]")
        if with_audio:
            graph.append(f"[0:a:0]atrim=start={start}:duration={seconds},asetpts=PTS-STARTPTS[a{i}]")
            joins.append(f"[a{i}]")
    # Write to a sibling first so a failed export leaves the previous film intact.
    with tempfile.TemporaryDirectory(dir=root) as work:
        temp=Path(work)/"film.mp4"
        if continuous and abs(elapsed-length)<.002 and with_audio==has_audio:
            shutil.copyfile(source,temp)
        else:
            graph.append("".join(joins)+f"concat=n={len(shots)}:v=1:a={int(with_audio)}[video]"+("[audio]" if with_audio else ""))
            cmd=["ffmpeg","-v","error","-i",str(source),"-filter_complex",";".join(graph),"-map","[video]"]
            if with_audio: cmd.extend(["-map","[audio]","-c:a","aac"])
            subprocess.run([*cmd,"-c:v","libx264","-preset","veryfast","-crf","18","-movflags","+faststart",str(temp)],check=True)
        temp.replace(output)
    print(output)
    return True


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("action",choices=["build","preview","render"],nargs="?",default="build")
    p.add_argument("--edit",default="edit.json",help="Timeline file in this project.")
    args=p.parse_args()
    root=Path(__file__).resolve().parent
    edit=json.loads((root/args.edit).read_text(encoding="utf8"))
    for key in [edit.get("audio")]+[s.get("media") for s in edit["shots"]]:
        if key:
            asset_url(key)
            if not (root/key).is_file(): p.error("Missing local asset: "+key)
    for name,content in assembled(edit,lambda c:(root/"components"/(c+".html")).read_text(encoding="utf8")).items():
        dest=root/name
        dest.parent.mkdir(exist_ok=True)
        dest.write_text(content,encoding="utf8")
    if args.action=="build": return
    if args.action=="render" and render_footage(edit,root): return
    npx=shutil.which("npx.cmd" if os.name=="nt" else "npx")
    if not npx: p.error("Install Node.js 22 or later for preview and render.")
    env=os.environ.copy()
    if os.name=="nt":
        env.setdefault("PRODUCER_FORCE_SCREENSHOT","true")
        chrome=Path(env.get("PROGRAMFILES","C:/Program Files"))/"Google/Chrome/Application/chrome.exe"
        if chrome.exists(): env.setdefault("HYPERFRAMES_BROWSER_PATH",str(chrome))
    options=["--workers","1","--output",str(root/"film.mp4")] if args.action=="render" else []
    if os.name=="nt" and args.action=="render": options.append("--no-browser-gpu")
    subprocess.run([npx,"--yes","hyperframes@"+VERSION,args.action,".",*options],cwd=root,env=env,check=True)


if __name__=="__main__": main()
