"""Check that authored content does not copy the sources verbatim (pattern from the NLP Study Lab).

Usage (from the repository root):
    python -I tools/check_overlap.py [--n 12]

Compares every run of N consecutive words (default 12) in the text fields of content/**/*.json against the
extracted text of the April 2015 draft and Zhao's book (content/_extracted/, git-ignored). Mathematical
notation is mostly short tokens, so formulas rarely trigger it; prose copied from a source does.
Reports file + item id + the first few words of each match. Exit code 1 if any match is found.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
EXTRACTED = CONTENT / "_extracted"
LIGATURES = str.maketrans({"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "’": "'", "‘": "'"})
SKIP_KEYS = {"id", "unit", "concept", "concepts", "sources", "verification", "check", "implementation", "tex", "prereqs", "related", "refs"}


def words(text: str) -> list[str]:
    text = re.sub(r"-\n", "", text)  # undo hyphenation at line ends in the extracted text
    return re.findall(r"[a-z0-9]+", text.translate(LIGATURES).lower())


def strings(node, item_id="?"):
    """Yield (item id, text) for every prose string in a content JSON tree."""
    if isinstance(node, dict):
        item_id = node.get("id", item_id)
        for k, v in node.items():
            if k not in SKIP_KEYS:
                yield from strings(v, item_id)
    elif isinstance(node, list):
        for v in node:
            yield from strings(v, item_id)
    elif isinstance(node, str):
        yield item_id, node


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=12)
    n = ap.parse_args().n
    book_files = [EXTRACTED / "sutton-barto-2015.txt", *sorted((EXTRACTED / "zhao").glob("B_*.txt"))]
    grams = set()
    for f in book_files:
        w = words(f.read_text(encoding="utf-8"))
        grams.update(tuple(w[i : i + n]) for i in range(len(w) - n + 1))
    matches, checked = [], 0
    for path in sorted(CONTENT.rglob("*.json")):
        if "_extracted" in path.parts or path.parent.name == "source":
            continue
        for item, text in strings(json.loads(path.read_text(encoding="utf-8"))):
            w = words(text)
            checked += 1
            for i in range(len(w) - n + 1):
                if tuple(w[i : i + n]) in grams:
                    matches.append(f"{path.relative_to(ROOT)} [{item}]: \"{' '.join(w[i:i + 6])} …\"")
                    break
    print(f"checked {checked} strings against {len(book_files)} source files at n = {n}: {len(matches)} match(es)")
    for m in matches:
        print("  - " + m)
    sys.exit(1 if matches else 0)


if __name__ == "__main__":
    main()
