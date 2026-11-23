"""Stage the gallery and indexed previews for GitHub Pages."""
import json
import os
import shutil
from pathlib import Path


root = Path(__file__).resolve().parents[1]
library = root / "library"
site = root / "_site"
site.mkdir(exist_ok=True)
repo = os.environ.get("GITHUB_REPOSITORY", "maan-iitd2/designer-video-studio")
ref = os.environ.get("GITHUB_SHA", "main")
page = (library / "index.html").read_text(encoding="utf-8")
page = page.replace('data-source-base=""', f'data-source-base="https://github.com/{repo}/blob/{ref}/library/"')
(site / "index.html").write_text(page, encoding="utf-8")
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
