"""Create editable HyperFrames projects from the Studio reference index."""
import argparse
from functools import lru_cache
import hashlib
from html import escape
import json
from pathlib import Path
import shutil
import subprocess
from zipfile import ZipFile, ZIP_DEFLATED

from project import assembled

ROOT=Path(__file__).resolve().parents[1]
HF=ROOT/"library/hyperframes"
REGISTRY=HF/"registry/components"
INDEX=ROOT/"motion/reference-index.json"
PROFILES=ROOT/"motion/remake-profiles.json"
FORMATS={"Landscape":(1920,1080),"Portrait":(1080,1920),"Square":(1080,1080)}
# Order describes a suggested sequence in each visual vocabulary.
TREATMENTS={
    "paper collage": ("paper-collage-reveal","split-tilt-cards","titlecard-lockup"),
    "shape morph": ("facet-morph","svg-stroke-trace","particle-text-dissolve"),
    "hand drawn": ("whiteboard-ink","vox-annotate","svg-stroke-trace"),
    "map": ("svg-stroke-trace","vox-annotate","whiteboard-ink"),
    "editorial": ("vox-annotate","marker-highlight","titlecard-lockup"),
    "grid layout": ("grid-card-assemble","screen-flow-carousel","titlecard-lockup"),
    "phone": ("browser-device-stage","screen-flow-carousel","state-chip-rail"),
    "code": ("code-terminal-run","state-chip-rail","per-word-rise"),
    "charts": ("chart-story","vox-annotate","count-up"),
    "diagrams": ("whiteboard-ink","svg-stroke-trace","grid-card-assemble"),
    "photos": ("paper-collage-reveal","split-tilt-cards","titlecard-lockup"),
    "characters": ("whiteboard-ink","split-tilt-cards","marker-highlight"),
    "particles": ("particle-text-dissolve","facet-morph","char-slam-explode"),
    "shapes": ("facet-morph","svg-stroke-trace","grid-card-assemble"),
    "product-ui": ("browser-device-stage","screen-flow-carousel","grid-card-assemble"),
    "music": ("char-slam-explode","kinetic-type-swap","particle-text-dissolve"),
    "kinetic-type": ("per-word-rise","headline-slam","kinetic-type-swap"),
}
PALETTES=[("#ede9df","#a64224"),("#141c28","#ebaf5b"),("#172019","#b8e774"),("#f6ebef","#79417f")]
GUIDE="""# Edit this film

Double-click Edit.html for the shot editor. Change the shots and save edit.json over the file in
this folder. When returning to an edit, use Open saved edit to load your latest edit.json.
You can also edit the JSON directly. Each shot has a duration, two colors and a motion component or media file.
Change the words in variables, reorder the shots, or replace a shot by setting its media to a local
file such as assets/screen.png or assets/demo.mp4. Create the assets folder and put your files there.
For video, source_start is the trim-in time in seconds. To use a soundtrack, set audio to its local path.
The chart values and all default illustrations are editable demo material.

From this folder, with Python 3.9+ and Node.js 22+ installed, run:

    python project.py preview
    python project.py render

Render writes film.mp4. Preview and render rebuild the timeline from edit.json.
On Windows you can also double-click Preview.cmd or Render.cmd. The first run needs internet for the
pinned HyperFrames CLI and the GSAP animation library. Rendering uses your computer and no model API.
In regular Claude chat, attach only edit.json and ask for a revision to the copy or shot order.
Save the returned JSON in place and preview again.

The reference field credits the original creator and links to the source. When present,
creator_workflow is a creator-published resource. The Studio selected the motion components.
Timing and palette provenance is recorded in basis. A measured cut is an estimate at sampled frames.
The creator's original scene graph, keyframes, illustrations, audio and prompt are separate.
The components directory contains upstream Apache-2.0 HyperFrames primitives. See HyperFrames-LICENSE.
The generated instances directory gives repeated shots independent animation timelines.
"""


@lru_cache(maxsize=None)
def component_source(name):
    return (REGISTRY/name/(name+".html")).read_text(encoding="utf8")


def variables(name, title, tags, i):
    words=title.split()
    short=" ".join(words[:3])
    lead=words[0]
    labels=", ".join(t.replace("-"," ").title() for t in tags[:3]) or "Idea, Detail, Result"
    fields={
        "titlecard-lockup":dict(wordmark=short,label=" ".join(words[3:]),kicker=""),
        "kinetic-type-swap":dict(prefix="",options=", ".join(words[:5]),suffix=""),
        "per-word-rise":dict(text=title),"headline-slam":dict(text=short),
        "whiteboard-ink":dict(caption=short),"particle-text-dissolve":dict(text=lead),
        "char-slam-explode":dict(text=words[i%len(words)]),
        "vox-annotate":dict(text=title,keyword=lead,note=" ".join(tags[:1]).replace("-"," ")),
        "marker-highlight":dict(text=title,emphasis_word=lead),
        "browser-device-stage":dict(title=short,chrome="phone" if "phone" in tags else "browser"),
        "screen-flow-carousel":dict(captions=labels,screens=3),
        "grid-card-assemble":dict(items=labels),"split-tilt-cards":dict(label_a=lead,label_b=words[-1],badge_a="",badge_b=""),
        "chart-story":dict(data="10, 24, 38",labels="Sample A, Sample B, Sample C",unit=""),
        "count-up":dict(start=0,end=3,suffix=""),
    }
    schema=json.loads((REGISTRY/name/"registry-item.json").read_text(encoding="utf8"))
    values={v["id"]:v["default"] for v in schema["variables"] if "default" in v}
    values.update(fields.get(name,{}))
    return values


def make_edit(row,profile):
    cues=[x for x in TREATMENTS if x in row["techniques"] or x in row["tags"]] or ["kinetic-type"]
    plan=list(dict.fromkeys(TREATMENTS[c][phase] for phase in range(3) for c in cues))
    # Give short suggested projects an opening, a development and a close.
    if not profile:
        plan=[TREATMENTS[cues[0]][0],TREATMENTS[cues[min(1,len(cues)-1)]][1],TREATMENTS[cues[0]][2]]
    bg,accent=PALETTES[int(hashlib.sha256(row["id"].encode()).hexdigest()[:8],16)%len(PALETTES)]
    beats=profile["beats"] if profile else [dict(start=s,background=bg,accent=accent) for s in (0,2.8,6.4)]
    duration=profile["seconds"] if profile else 9
    width,height=(profile["width"],profile["height"]) if profile else FORMATS[row["format"]]
    shots=[]
    for i,beat in enumerate(beats):
        end=beats[i+1]["start"] if i+1<len(beats) else duration
        component=plan[i%len(plan)]
        shots.append(dict(seconds=round(end-beat["start"],3),component=component,background=beat["background"],
            accent=beat["accent"],variables=variables(component,row["title"],row["tags"],i),media=""))
    ref=dict(id=row["id"],creator=row["creator"],post=row["post"],page=row["url"])
    if row.get("skill"): ref["creator_workflow"]=row["skill"]
    return dict(title=row["title"],reference=ref,basis="Measured duration, frame size, estimated cuts and sampled palette" if profile
                else "Suggested timing and palette based on catalog attributes",width=width,height=height,audio="",shots=shots)


def project_files(edit):
    components={s["component"] for s in edit["shots"]}
    files={f"components/{name}.html":component_source(name) for name in components}
    files.update(assembled(edit,component_source))
    editor=(ROOT/"motion/remake-editor.html").read_text(encoding="utf8")
    files["Edit.html"]=editor.replace("__STUDIO_EDIT__",json.dumps(edit,ensure_ascii=True).replace("<","\\u003c"))
    files.update({"edit.json":json.dumps(edit,ensure_ascii=False,indent=2)+"\n","README.md":GUIDE,
                  "project.py":Path(__file__).with_name("project.py").read_text(encoding="utf8"),
                  "HyperFrames-LICENSE":(HF/"LICENSE").read_text(encoding="utf8")})
    for cmd in ("preview","render"):
        files[cmd.capitalize()+".cmd"]=f'@echo off\r\ncd /d "%~dp0"\r\npython project.py {cmd}\r\nif errorlevel 1 pause\r\n'
    return files


def build_gallery(site):
    out=site/"remakes"
    out.mkdir(exist_ok=True)
    profiles=json.loads(PROFILES.read_text(encoding="utf8"))
    rows=json.loads(INDEX.read_text(encoding="utf8"))["entries"]
    with ZipFile(out/"all-projects.zip","w",ZIP_DEFLATED) as bundle:
        links=[]
        for row in rows:
            slug=row["id"]
            files=project_files(make_edit(row,profiles.get(slug)))
            with ZipFile(out/(slug+".zip"),"w",ZIP_DEFLATED) as z:
                for name in sorted(files):
                    data=files[name].encode("utf8")
                    z.writestr(name,data)
                    bundle.writestr(slug+"/"+name,data)
            label=escape(row["title"])+" · @"+escape(row["creator"])
            links.append(f'<li><a href="{slug}/Edit.html">{label}</a> <small>{escape(", ".join(row["tags"]))}</small></li>')
        bundle.writestr("Start.html", """<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Motion Index · Projects</title>
<style>body{margin:4vh auto;padding:1rem;max-width:54rem;background:#f5f3eb;color:#243429;font:17px/1.5 system-ui}h1{font:3rem Georgia,serif}input{font:inherit;padding:8px;width:90%}ul{padding:0;list-style:none}li{padding:8px 0;border-bottom:1px solid #c6c9bf}a{color:inherit}small{display:block;color:#505c53}</style>
<h1>Motion Index</h1><p>Choose a project to edit its shots. Run Preview or Render from that project's folder.</p>
<input type="search" aria-label="Search projects" placeholder="Search by title, style or creator"><ul>"""+
            "".join(links)+"""</ul><script>document.querySelector('input').oninput=e=>{const terms=e.target.value.toLowerCase().trim().split(/\s+/);for(const item of document.querySelectorAll('li'))item.hidden=!terms.every(t=>item.textContent.toLowerCase().includes(t))}</script></html>""")


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("id")
    p.add_argument("--output",type=Path)
    p.add_argument("--source-cut",action="store_true",help="Use the local reference footage at its measured trim points.")
    p.add_argument("--media-position",type=int,help="Use a particular downloaded attachment in a multi-video post, numbered from 1.")
    args=p.parse_args()
    rows=json.loads(INDEX.read_text(encoding="utf8"))["entries"]
    row=next((r for r in rows if r["id"]==args.id),None)
    if not row: p.error("Unknown reference ID. Copy the ID following #ref= in the gallery URL.")
    profile=json.loads(PROFILES.read_text(encoding="utf8")).get(args.id)
    media=None
    if args.source_cut or args.media_position is not None:
        manifest=ROOT/"downloads/x/manifest.json"
        entries=json.loads(manifest.read_text(encoding="utf8"))["entries"] if manifest.exists() else []
        chosen=next((m for r in entries if r["id"]==args.id for m in r["media"] if m["status"]=="downloaded"
                     and (args.media_position is None or args.media_position==m["position"])),None)
        if not chosen: p.error("Download this reference locally first.")
        local=manifest.parent/chosen["file"]
        if not local.is_file(): p.error("Missing local video: "+str(local))
        if args.source_cut: media=local
        if args.media_position is not None or not profile:
            from analyze_references import analyze
            _,profile=analyze((row,chosen,manifest.parent))
    edit=make_edit(row,profile)
    if args.media_position is not None: edit["reference"]["media_position"]=args.media_position
    if media:
        audio_stream=subprocess.check_output(["ffprobe","-v","error","-select_streams","a:0",
            "-show_entries","stream=index","-of","csv=p=0",str(media)],text=True).strip()
        for shot,beat in zip(edit["shots"],profile["beats"]):
            shot.update(media="assets/reference.mp4",source_start=beat["start"],media_has_audio=bool(audio_stream))
    suffix=(f"-media-{args.media_position}" if args.media_position is not None else "")+("-source" if media else "")
    folder=args.output or ROOT/"films"/(args.id+suffix)
    if folder.exists(): p.error("Output already exists. Edit its edit.json or choose a new --output folder.")
    files=project_files(edit)
    folder.mkdir(parents=True)
    if media:
        (folder/"assets").mkdir()
        shutil.copyfile(media,folder/"assets/reference.mp4")
    for name,content in files.items():
        dest=folder/name
        dest.parent.mkdir(exist_ok=True)
        dest.write_bytes(content.encode("utf8"))
    print(folder.resolve())


if __name__=="__main__": main()
