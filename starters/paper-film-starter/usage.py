"""Summarize one Claude Code session and its saved subagent transcripts."""
import argparse
import json
from collections import Counter
from pathlib import Path


def inspect_session(path):
    calls = {}
    ledger = None
    images = 0
    with path.open(encoding="utf-8") as stream:
        for line in stream:
            row = json.loads(line)
            message = row.get("message") or {}
            if row["type"] == "cost-state":
                ledger = row
            if row["type"] == "user" and isinstance(message.get("content"), list):
                for block in message["content"]:
                    result = block.get("content")
                    if block.get("type") == "tool_result" and isinstance(result, list):
                        images += sum(item.get("type") == "image" for item in result)
            if row["type"] != "assistant" or message.get("model") == "<synthetic>":
                continue
            if not message.get("usage") or not message.get("id"):
                continue
            key = row.get("requestId"), message["id"]
            usage = message["usage"]
            if key not in calls or usage.get("output_tokens", 0) >= calls[key].get("output_tokens", 0):
                calls[key] = usage
    counts = Counter(calls=len(calls), images=images)
    for usage in calls.values():
        for key in ["input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens", "output_tokens"]:
            counts[key] += usage.get(key, 0)
        counts["thinking_within_output"] += (usage.get("output_tokens_details") or {}).get("thinking_tokens", 0)
    return counts, ledger


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("transcript", type=Path)
    path = parser.parse_args().transcript
    total = Counter()
    for file in [path, *sorted((path.with_suffix("") / "subagents").glob("*.jsonl"))]:
        counts, ledger = inspect_session(file)
        total.update(counts)
        print(file.stem, json.dumps(counts))
        if file == path and ledger:
            print("Session estimate (USD)", ledger.get("totalCostUSD"))
            print("Session model totals", json.dumps(ledger.get("modelUsage")))
    print("Transcript totals", json.dumps(total))


if __name__ == "__main__":
    main()

