"""Find local shots by words or by an exact gallery ID."""
import argparse
import json
import re
from pathlib import Path


def search(rows, query):
    text = query.casefold().strip()
    exact = [row for row in rows if row["id"].casefold() == text]
    if exact:
        return exact
    terms = re.findall(r"\w+", text)
    ranked = []
    for row in rows:
        title = (row["id"] + " " + row["title"]).casefold()
        labels = (row["group"] + " " + row["category"] + " " + row.get("tags", "")).casefold()
        full = " ".join([title, labels, row.get("desc", "").casefold()])
        if terms and all(term in full for term in terms):
            score = sum(4 * (term in title) + 2 * (term in labels) for term in terms)
            ranked.append((-score, row["id"], row))
    return [row for _, _, row in sorted(ranked)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("query", help="Example: paper timeline or shotcraft/card-stack")
    parser.add_argument("--limit", type=int, choices=range(1, 21), default=5, metavar="1–20")
    args = parser.parse_args()
    with Path(__file__).with_name("catalog.jsonl").open(encoding="utf-8") as source:
        matches = search([json.loads(line) for line in source], args.query)
    if not matches:
        print("No matches. Try a shorter phrase such as 'timeline', 'type' or 'zoom'.")
    for row in matches[:args.limit]:
        print(row["id"], "|", row["title"], "|", row["category"])
        for key in ("video", "poster", "source", "recipe"):
            if key in row:
                print(f"  {key}: library/{row[key]}")


if __name__ == "__main__":
    main()
