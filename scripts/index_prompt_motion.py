"""Refresh the public reference metadata. Video and prompt bodies are never archived."""
import argparse
import collections
import concurrent.futures
import datetime
import json
import re
import time
import urllib.error
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

HOME = "https://prompt-motion.com/"
AGENT = "DesignerVideoStudio-ReferenceIndex/1.0 (+https://github.com/maan-iitd2/designer-video-studio)"
OUTPUT = Path(__file__).resolve().parents[1] / "motion" / "reference-index.json"
SLUG = re.compile(r"[\w-]+-[a-f0-9]{5,9}$")
TECHNIQUES = {
    "paper collage": r"\b(?:paper.cut|collage|scrapbook|torn paper|cutouts?)\b",
    "editorial": r"\b(?:engraving|editorial|newsprint|halftone|newspaper)\b",
    "grid layout": r"\b(?:grid|bento|contact sheet)\b",
    "shape morph": r"\b(?:morph(?:s|ing)?|shape.shift)\b",
    "3D": r"\b(?:3d|three\.js|webgl)\b",
    "camera movement": r"\b(?:camera move|camera zoom|dolly|parallax|zoom(?:s|ing)?)\b",
    "hand drawn": r"\b(?:hand.drawn|sketch(?:es)?|doodl\w*)\b",
    "scroll": r"\bscroll(?:s|ing)?\b",
    "beat sync": r"\b(?:downbeat|beat.sync|beats? per minute|\d+\s*bpm|on (?:the|every) beat)\b",
    "masked reveal": r"\b(?:mask(?:ed|ing)?|iris wipe|clipping mask)\b",
    "screen demo": r"\b(?:screenshots?|screen record\w*|screencast)\b",
    "typography": r"\b(?:kinetic typ\w*|letterforms?|typeface|typography)\b",
    "charts": r"\b(?:bar chart|scatter plot|line chart|histogram|animated chart)\b",
    "map": r"\b(?:maps?|geographic|globe)\b",
    "retro": r"\b(?:retro|vintage|analog|analogue|vhs|pixel art)\b",
    "film texture": r"\b(?:film grain|grainy|textured paper|filmstrip|film stock)\b",
    "captions": r"\b(?:subtitles?|captions?|talking.head)\b",
    "isometric": r"\bisometric\b",
    "monochrome": r"\b(?:monochrom\w*|black.and.white)\b",
    "loop": r"\b(?:seamless loop|perfect loop|loops back|looping)\b"
}


def fetch(url, rules=None):
    if rules and not rules.can_fetch(AGENT, url):
        raise ValueError("Disallowed by robots.txt: " + url)
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": AGENT})
            with urllib.request.urlopen(request, timeout=18) as response:
                return response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
            time.sleep(max(2 ** attempt, int(error.headers.get("Retry-After", "0") or "0")))
        except (OSError, TimeoutError):
            if attempt == 2: raise
            time.sleep(2 ** attempt)


class Metadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.post = self.skill = ""
        self.stack = []
        self.blocks = collections.defaultdict(list)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a":
            href = a.get("href", "")
            if re.fullmatch(r"https://(?:www\.)?(?:x|twitter)\.com/[\w]+/status/[0-9]+/?", href) and not self.post:
                self.post = href
            if re.fullmatch(r"https://github\.com/[\w.-]+/[\w.-]+(?:/tree/[\w./%-]+)?/?", href) and not self.skill:
                self.skill = href
        if tag in ("pre","dt","dd") or ("whitespace-pre-wrap" in (a.get("class") or "").split() and not self.stack):
            self.stack.append((tag,tag if tag in ("dt","dd") else "prompt",[]))

    def handle_endtag(self, tag):
        if self.stack and self.stack[-1][0] == tag:
            _,kind,parts=self.stack.pop()
            self.blocks[kind].append(" ".join("".join(parts).split()))

    def handle_data(self, data):
        for record in self.stack: record[2].append(data)


def cards_from(page):
    for raw in re.findall(r'self\.__next_f\.push\((.*?)\)</script>',page,re.S):
        frame=json.loads(raw)[-1]
        if isinstance(frame,str) and '"cards":' in frame and '"contentTags"' in frame:
            cards,_=json.JSONDecoder().raw_decode(frame.split('"cards":',1)[1])
            return cards
    raise ValueError("Missing public gallery data")


def make_entry(card, rules):
    slug=card["slug"]
    source=HOME+slug
    parsed=Metadata()
    parsed.feed(fetch(source,rules))
    details=dict(zip(parsed.blocks["dt"],parsed.blocks["dd"]))
    body=" ".join(parsed.blocks["prompt"])
    # Use simple term presence for retrieval; ignore explicitly excluded techniques.
    safe_parts=[part for part in re.split(r"(?<=[.!?;])\s+|\n",body)
                if not re.search(r"\b(?:banned|avoid|without|no|never|do not|don't)\b",part,re.I)]
    terms=card["title"]+". "+" ".join(safe_parts)
    width,height=card.get("width"),card.get("height")
    ratio=(width/height) if width and height else None
    poster=card.get("poster","")
    result={"id":slug,"title":card["title"],"creator":card["handle"],"date":card["date"],
            "tags":card["contentTags"],"kind":card["tags"],"techniques":[k for k,v in TECHNIQUES.items() if re.search(v,terms,re.I)],
            "format":("Square" if .93<=ratio<=1.07 else "Portrait" if ratio<1 else "Landscape") if ratio else "Unspecified",
            "url":source,"post":parsed.post}
    if urlparse(poster).hostname=="media.prompt-motion.com":result["thumbnail"]=poster
    if "skill" in result["kind"] and parsed.skill:result["skill"]=parsed.skill
    for k in ["Model","Stack"]:
        if details.get(k):result[k.lower()]=details[k]
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh",action="store_true",help="Re-read metadata for previously indexed entries.")
    args=parser.parse_args()
    rules=urllib.robotparser.RobotFileParser()
    rules.parse(fetch(HOME+"robots.txt").splitlines())
    cards=cards_from(fetch(HOME,rules))
    tree=ET.fromstring(fetch(HOME+"sitemap.xml",rules))
    entries={url.text.removeprefix(HOME) for url in tree.findall(".//{*}loc") if url.text and url.text.startswith(HOME) and SLUG.fullmatch(url.text.removeprefix(HOME))}
    ids=[c["slug"] for c in cards]
    if len(set(ids))!=len(ids) or entries!=set(ids):raise ValueError("Gallery/sitemap differ. Check the publisher before updating.")
    cache={}
    if OUTPUT.exists() and not args.refresh:cache={r["id"]:r for r in json.loads(OUTPUT.read_text(encoding="utf-8"))["entries"]}
    missing=[c for c in cards if c["slug"] not in cache or
             ("skill" in c["tags"] and not cache[c["slug"]].get("skill"))]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for item in pool.map(lambda c:make_entry(c,rules),missing):
            cache[item["id"]]=item
    data={"source":HOME,"checked":datetime.date.today().isoformat(),"entries":[cache[i] for i in ids]}
    tmp=OUTPUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(data,ensure_ascii=False,indent=1)+"\n",encoding="utf-8")
    tmp.replace(OUTPUT)
    print(len(ids),"verified entries;",sum(bool(cache[k]["post"]) for k in ids),"linked creator posts")


if __name__=="__main__":main()
