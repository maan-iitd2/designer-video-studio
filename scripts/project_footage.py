"""Download the original for one unpacked project and prepare editable footage cuts."""
from copy import deepcopy
import json
from pathlib import Path
import shutil
import subprocess
import sys

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE/"tools"))
from analyze_references import analyze
from download_references import download, lock_folder


def main():
    if not all(shutil.which(tool) for tool in ("ffmpeg","ffprobe")):
        raise SystemExit("Install FFmpeg, including ffprobe, to download and inspect footage.")
    edit=json.loads((HERE/"edit.json").read_text(encoding="utf8"))
    ref=edit["reference"]
    row=dict(id=ref["id"],title=edit["title"],creator=ref["creator"],post=ref["post"],url=ref["page"])
    folder=HERE/"footage"
    folder.mkdir(exist_ok=True)
    with lock_folder(folder):
        result=download(row,folder)
        manifest=folder/"manifest.json"
        temp=manifest.with_suffix(".tmp")
        temp.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf8")
        temp.replace(manifest)
        print(row["post"],result["status"])
        for media in result["media"]:
            if media["status"]!="downloaded": continue
            dest=HERE/("edit-footage-"+str(media["position"])+".json")
            if dest.exists():
                print("Keeping existing edit:",dest.name)
                continue
            _,profile=analyze((row,media,folder))
            has_audio=subprocess.check_output(["ffprobe","-v","error","-select_streams","a:0","-show_entries",
                "stream=index","-of","csv=p=0",str(folder/media["file"])],text=True).strip()
            cut=deepcopy(edit)
            cut.update(width=media["width"],height=media["height"],basis="Local source footage with estimated cut points",audio="",shots=[])
            for i,beat in enumerate(profile["beats"]):
                end=profile["beats"][i+1]["start"] if i+1<len(profile["beats"]) else media["seconds"]
                shot=deepcopy(edit["shots"][i%len(edit["shots"])])
                shot.update(media="footage/"+media["file"],source_start=beat["start"],media_has_audio=bool(has_audio),
                    seconds=round(end-beat["start"],3),background=beat["background"],accent=beat["accent"])
                cut["shots"].append(shot)
            dest.write_text(json.dumps(cut,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
            print("Open",dest.name,"in Edit.html, or run: python project.py render --edit",dest.name)
        print("Local download details:",manifest)


if __name__=="__main__": main()
