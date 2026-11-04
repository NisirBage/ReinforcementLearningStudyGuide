"""Build content/source/sources.json: the table of contents and page maps of every source the app cites.

Usage (from the repository root):
    python -I tools/build_sources.py

Reads the text layer extracted into content/_extracted/ (git-ignored, never committed):
  - sutton-barto-2015.txt                  Sutton & Barto, 2nd ed. draft of April 2015 (CORE, authoritative)
  - zhao/B_1_-_Table_of_contents.pdf.txt   Zhao, Mathematical Foundations of RL (supplementary)
  - zhao/B_3_*, B_4_*                      Zhao chapter files, for the printed-to-PDF page map
  - zhao/S_L*.txt, L6.txt, L7.txt          Zhao's lecture slides L1-L10 (supplementary)

Only titles, numbers and page/slide counts are written. No book text is stored in the output.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXTRACTED = ROOT / "content" / "_extracted"
OUT = ROOT / "content" / "source" / "sources.json"

LIGATURES = str.maketrans({"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "’": "'"})
LABEL = re.compile(r"^(∗?)(\d+(?:\.\d+)*|[A-D](?:\.\d+)?|I{1,3}|IV)$")
PAGE = re.compile(r"^(\d+|[ivxlc]+)$")
ROMAN = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10, "xi": 11, "xii": 12, "xiii": 13, "xiv": 14}

# Zhao publishes one PDF per chapter (repository MathFoundationRL/Book-Mathematical-Foundation-of-Reinforcement-Learning).
ZHAO_FILES = {
    "1": "3 - Chapter 1 Basic Concepts.pdf",
    "2": "3 - Chapter 2 State Values and Bellman Equation.pdf",
    "3": "3 - Chapter 3 Optimal State Values and Bellman Optimality Equation.pdf",
    "4": "3 - Chapter 4 Value Iteration and Policy Iteration.pdf",
    "5": "3 - Chapter 5 Monte Carlo Methods.pdf",
    "6": "3 - Chapter 6 Stochastic Approximation.pdf",
    "7": "3 - Chapter 7 Temporal-Difference Methods.pdf",
    "8": "3 - Chapter 8 Value Function Methods.pdf",
    "9": "3 - Chapter 9 Policy Gradient Methods.pdf",
    "10": "3 - Chapter 10 Actor-Critic Methods.pdf",
    **{a: "4 - Appendix.pdf" for a in "ABCD"},
}

LECTURE_TITLES = {
    1: "Basic Concepts", 2: "Bellman Equation", 3: "Bellman Optimality Equation", 4: "Value Iteration and Policy Iteration",
    5: "Monte Carlo Methods", 6: "Stochastic Approximation and Stochastic Gradient Descent", 7: "Temporal-Difference Learning",
    8: "Value Function Methods", 9: "Policy Gradient Methods", 10: "Actor-Critic Methods",
}


def toc_tokens(text: str) -> list[str]:
    out = []
    for line in text.translate(LIGATURES).splitlines():
        line = re.sub(r"(\s*\.\s*){2,}$", "", line).strip()  # dot leaders
        if not line or line.startswith("=====") or line in ("Contents", "CONTENTS"):
            continue
        # Some entries put the number and the title on one line ("2.10 Q&A", "10 Actor-Critic Methods").
        m = re.match(r"^(∗?(?:\d+(?:\.\d+)*|[A-D](?:\.\d+)?))\s+(\D.*)$", line)
        if m and not PAGE.match(line):
            out.extend([m.group(1), m.group(2)])
            continue
        out.append(line)
    return out


def parse_toc(tokens: list[str]) -> list[dict]:
    """Token stream 'label title... page' (label optional for front/back matter)."""
    entries, i = [], 0
    while i < len(tokens):
        star, label = "", None
        m = LABEL.match(tokens[i])
        if m and i + 1 < len(tokens) and not PAGE.match(tokens[i + 1]):
            star, label = m.group(1), m.group(2)
            i += 1
        title = []
        while i < len(tokens) and not PAGE.match(tokens[i]):
            title.append(tokens[i])
            i += 1
        if i >= len(tokens):
            break
        page = tokens[i]
        i += 1
        if title:
            entries.append({"label": label, "title": " ".join(title), "page": page, "optional": bool(star)})
    return entries


def level(label: str | None) -> str:
    if label is None:
        return "matter"
    if re.fullmatch(r"I{1,3}|IV", label):
        return "part"
    if re.fullmatch(r"\d+|[A-D]", label):
        return "chapter"
    return "section" if label.count(".") == 1 else "subsection"


def build_book(entries: list[dict], pdf_offset: int | None, last_page: int) -> dict:
    chapters, parts, matter = [], [], []
    part = None
    for e in entries:
        lv = level(e["label"])
        page = int(e["page"]) if e["page"].isdigit() else None
        if lv == "part":
            part = e["title"]
            parts.append({"label": e["label"], "title": e["title"], "page": page})
        elif lv == "chapter":
            chapters.append({"id": e["label"], "title": e["title"], "part": part, "startPage": page, "sections": []})
        elif lv in ("section", "subsection"):
            if not chapters or not e["label"].startswith(chapters[-1]["id"] + "."):
                sys.exit(f"section {e['label']} is not inside the current chapter")
            chapters[-1]["sections"].append({"id": e["label"], "title": e["title"], "page": page, "level": lv, "optional": e["optional"]})
        else:
            matter.append({"title": e["title"], "page": e["page"]})
    # A chapter ends on the page before the next chapter, part page or back-matter entry.
    starts = sorted({c["startPage"] for c in chapters} | {p["page"] for p in parts if p["page"]}
                    | {int(m["page"]) for m in matter if m["page"].isdigit()} | {last_page + 1})
    for c in chapters:
        c["endPage"] = min(s for s in starts if s > c["startPage"]) - 1
        if c["endPage"] < c["startPage"]:
            sys.exit(f"chapter {c['id']} has no pages")
    return {"pdfPageOffset": pdf_offset, "parts": parts, "chapters": chapters, "matter": matter}


def zhao_file_offsets() -> dict[str, tuple[int, int]]:
    """Per Zhao chapter file: (offset, page count) with printed page = PDF page + offset, checked page by page."""
    out = {}
    for f in EXTRACTED.glob("zhao/B_[34]_*.txt"):
        pages = re.split(r"=====P \d+=====", f.read_text(encoding="utf-8"))[1:]
        votes: dict[int, int] = {}
        for i, pg in enumerate(pages, start=1):
            ls = [l.strip() for l in pg.strip().splitlines() if l.strip()]
            for d in {int(l) - i for l in ls[:3] + ls[-3:] if re.fullmatch(r"\d{1,3}", l)}:
                votes[d] = votes.get(d, 0) + 1
        offset, hits = max(votes.items(), key=lambda kv: kv[1])
        if hits < len(pages):
            sys.exit(f"{f.name}: page numbers found on only {hits} of {len(pages)} pages for offset {offset}")
        m = re.search(r"Chapter_(\d+)", f.name)
        out["A" if m is None else m.group(1)] = (offset, len(pages))
    return out


def slide_count(path: Path) -> int:
    return len(re.findall(r"^=====(?:P|SLIDE) \d+=====$", path.read_text(encoding="utf-8"), re.M))


def main() -> None:
    sb_text = (EXTRACTED / "sutton-barto-2015.txt").read_text(encoding="utf-8")
    pages = re.split(r"=====PAGE \d+=====", sb_text)
    sb_toc = "\n".join(pages[3:8])  # PDF pages 3-7 hold the table of contents
    sb = build_book(parse_toc(toc_tokens(sb_toc)), 14, last_page=338)
    for m in sb["matter"]:
        m["pdfPage"] = ROMAN[m["page"]] if m["page"] in ROMAN else int(m["page"]) + 14

    zhao_text = (EXTRACTED / "zhao" / "B_1_-_Table_of_contents.pdf.txt").read_text(encoding="utf-8")
    zhao = build_book(parse_toc(toc_tokens(zhao_text)), None, last_page=275)
    offsets = zhao_file_offsets()
    for c in zhao["chapters"]:
        offset, count = offsets[c["id"] if c["id"].isdigit() else "A"]
        c["pdf"] = {"file": ZHAO_FILES[c["id"]], "offset": offset, "pages": count}
        if c["id"].isdigit():
            c["endPage"] = offset + count  # the chapter's own file says where it ends
        if not (offset + 1 <= c["startPage"] <= c["endPage"] <= offset + count):
            sys.exit(f"Zhao chapter {c['id']} pages {c['startPage']}-{c['endPage']} not inside its file")

    lectures = []
    for n, title in LECTURE_TITLES.items():
        f = EXTRACTED / ("L6.txt" if n == 6 else "L7.txt" if n == 7 else "")  # the learner's own copies of L6, L7
        if n not in (6, 7):
            f = next(EXTRACTED.glob(f"zhao/S_L{n}-*.txt"), None)
        if f is None or not f.exists():
            sys.exit(f"missing lecture L{n}")
        lectures.append({"id": f"L{n}", "number": n, "title": title, "slides": slide_count(f), "zhaoChapter": str(n)})

    out = {
        "sb": {
            "key": "sb",
            "role": "core",
            "title": "Reinforcement Learning: An Introduction (2nd ed., draft in progress)",
            "authors": "Richard S. Sutton and Andrew G. Barto",
            "edition": "Draft of April 2015 (PDF built 12 April 2015, 352 pages)",
            **sb,
        },
        "zhao": {
            "key": "zhao",
            "role": "supplementary",
            "title": "Mathematical Foundations of Reinforcement Learning",
            "authors": "Shiyu Zhao",
            "edition": "GitHub PDF incorporating the July 2025 errata to the Springer edition; one PDF per chapter",
            **zhao,
        },
        "lectures": {"key": "lectures", "role": "supplementary", "title": "Lecture slides L1–L10 (Zhao)", "authors": "Shiyu Zhao", "items": lectures},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    n_sec = lambda b: sum(len(c["sections"]) for c in b["chapters"])
    print(f"sb (core): {len(sb['chapters'])} chapters, {n_sec(sb)} sections | "
          f"zhao (supplementary): {len(zhao['chapters'])} chapters, {n_sec(zhao)} sections | lectures: {len(lectures)}")


if __name__ == "__main__":
    main()
