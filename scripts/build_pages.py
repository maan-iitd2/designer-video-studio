"""Stage the gallery and indexed previews for GitHub Pages."""
import json
import os
import shutil
from pathlib import Path
from remake import REBUILDS, build_gallery


root = Path(__file__).resolve().parents[1]
library = root / "library"
site = root / "_site"
site.mkdir(exist_ok=True)
(site / "archive").mkdir(exist_ok=True)
repo = os.environ.get("GITHUB_REPOSITORY", "maan-iitd2/designer-video-studio")
ref = os.environ.get("GITHUB_SHA", "main")
page = (library / "index.html").read_text(encoding="utf-8")
page = page.replace('data-source-base=""', f'data-source-base="https://github.com/{repo}/blob/{ref}/library/"')
archive_page = page.replace('<meta charset="utf-8">', '<meta charset="utf-8"><base href="../">', 1)
(site / "archive" / "index.html").write_text(archive_page, encoding="utf-8")
for name in ("gallery.css", "catalog.js", "gallery.js"):
    shutil.copyfile(library / name, site / name)
for line in (library / "catalog.jsonl").read_text(encoding="utf-8").splitlines():
    row = json.loads(line)
    for key in ("source", "recipe", "poster", "video"):
        if key not in row:
            continue
        relative = Path(row[key])
        if relative.is_absolute() or ".." in relative.parts or not (library / relative).is_file():
            raise ValueError(f"Invalid {key} for {row['id']}")
        if key in ("poster", "video"):
            dest = site / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(library / relative, dest)

motion = root / "motion"
build_gallery(site)
for name in ("index.html", "motion.css", "motion.js", "playback.js", "films.json", "reference-index.json", "references.js", "reference-search.js", "references.css"):
    shutil.copyfile(motion / name, site / name)
index = json.loads((motion / "reference-index.json").read_text(encoding="utf8"))
measured = json.loads((motion / "remake-profiles.json").read_text(encoding="utf8"))
for entry in index["entries"]:
    entry["remakeBasis"] = "measured" if entry["id"] in measured else "suggested"
    if (REBUILDS / entry["id"] / "recipe.json").is_file():
        preview=motion / "previews" / (entry["id"]+"-rebuild.mp4")
        if not preview.is_file():
            raise ValueError("Missing exported project preview for "+entry["id"])
        entry["remakeBasis"] = "rebuilt"
(site / "reference-index.json").write_text(json.dumps(index, ensure_ascii=False), encoding="utf8")
shutil.copytree(motion / "previews", site / "previews", dirs_exist_ok=True)
for study in json.loads((motion / "films.json").read_text(encoding="utf-8")):
    slug = study["id"]
    for suffix in (".mp4", ".webp", "-frames.jpg"):
        if not (site / "previews" / (slug + suffix)).is_file():
            raise ValueError(f"Missing {slug}{suffix}")
    source = (motion / "scenes/stage.js").read_text(encoding="utf-8")
    source += "\n" + (motion / "scenes" / (slug + ".js")).read_text(encoding="utf-8")
    (site / "previews" / (slug + "-motion.txt")).write_text(source, encoding="utf-8")
