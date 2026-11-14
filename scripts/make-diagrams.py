"""Generate the beginner diagrams for the RAG article.

Black ink on white, hand-drawn wobble, curved circular-arc arrows. Each diagram is
described once and written twice:
  scripts/<name>.excalidraw   editable Excalidraw source
  public/articles/<name>.svg  image used by the article

Run from the project root:  python scripts/make-diagrams.py
The handwriting font is copied from an existing diagram so every picture matches.

Style words used by box() and circle():
  ""        plain outline
  "bold"    thick double outline: the thing to look at (the right answer)
  "dashed"  dashed outline: archived, rejected or optional
"""

from __future__ import annotations

import json
import math
import random
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_SVG = ROOT / "public" / "articles"
OUT_SRC = ROOT / "scripts"

INK = "#1e1e1e"
SOFT = "#6b6b6b"  # secondary captions: still readable on white (5.3:1)
CHAR_WIDTH = 0.56  # rough width of one handwriting character, in font sizes

FONT_CSS = re.search(
    r'<style class="style-fonts">(.*?)</style>',
    (OUT_SVG / "rag-triad.svg").read_text(encoding="utf-8"),
    re.S,
).group(1)


def wobble(rng: random.Random, value: float, amount: float = 1.5) -> float:
    return value + rng.uniform(-amount, amount)


def rough_rect(x, y, w, h, rng, radius=16) -> str:
    """A rectangle with circular-arc corners, drawn twice with a small wobble, like a pen going round twice."""
    r = min(radius, w / 2, h / 2)
    passes = []
    for _ in range(2):
        j = lambda v, amount=1.3: wobble(rng, v, amount)
        d = f"M{x + r:.1f} {j(y):.1f}"
        d += f" Q{x + w / 2:.1f} {j(y, 2.2):.1f} {x + w - r:.1f} {j(y):.1f}"
        d += f" A{r} {r} 0 0 1 {j(x + w):.1f} {y + r:.1f}"
        d += f" Q{j(x + w, 2.2):.1f} {y + h / 2:.1f} {j(x + w):.1f} {y + h - r:.1f}"
        d += f" A{r} {r} 0 0 1 {x + w - r:.1f} {j(y + h):.1f}"
        d += f" Q{x + w / 2:.1f} {j(y + h, 2.2):.1f} {x + r:.1f} {j(y + h):.1f}"
        d += f" A{r} {r} 0 0 1 {j(x):.1f} {y + h - r:.1f}"
        d += f" Q{j(x, 2.2):.1f} {y + h / 2:.1f} {j(x):.1f} {y + r:.1f}"
        d += f" A{r} {r} 0 0 1 {x + r:.1f} {j(y):.1f} Z"
        passes.append(d)
    return " ".join(passes)


def rough_circle(cx, cy, r, rng) -> str:
    passes = []
    for _ in range(2):
        pts = [(cx + wobble(rng, r, 1.5) * math.cos(t), cy + wobble(rng, r, 1.5) * math.sin(t))
               for t in [i * math.pi / 4 + rng.uniform(-0.05, 0.05) for i in range(8)]]
        d = f"M{pts[0][0]:.1f} {pts[0][1]:.1f}"
        for p in pts[1:] + pts[:1]:
            d += f" A{r:.1f} {r:.1f} 0 0 1 {p[0]:.1f} {p[1]:.1f}"
        passes.append(d)
    return " ".join(passes)


class Diagram:
    def __init__(self, name: str, width: int, height: int, title: str):
        self.name, self.w, self.h = name, width, height
        self.items: list[dict] = []
        self.rng = random.Random(name)
        self.text(width / 2, 44, title, size=30, anchor="middle")

    # --- primitives -------------------------------------------------------
    def box(self, x, y, w, h, text="", size=18, style="", lh=1.3):
        self.items.append(dict(kind="box", x=x, y=y, w=w, h=h, style=style))
        if text:
            widest = max(len(line) for line in text.split("\n")) * size * CHAR_WIDTH
            if widest > w - 24:
                print(f"  ! {self.name}: text may be tight in box ({widest:.0f}px in {w - 24}px): {text.splitlines()[0]!r}")
            self.text(x + w / 2, y + h / 2, text, size=size, anchor="middle", middle=True, lh=lh)

    def text(self, x, y, text, size=20, anchor="start", color=INK, middle=False, lh=1.3):
        self.items.append(dict(kind="text", x=x, y=y, text=text, size=size, anchor=anchor, color=color, middle=middle, lh=lh))

    def arrow(self, x1, y1, x2, y2, bend=0.18, dashed=False):
        """A circular arc from (x1,y1) to (x2,y2). `bend` is the sagitta as a share of the length;
        negative bulges to the left of the direction of travel, positive to the right."""
        self.items.append(dict(kind="arrow", x1=x1, y1=y1, x2=x2, y2=y2, bend=bend, dashed=dashed))

    def line(self, x1, y1, x2, y2):
        """A plain hand-drawn line with no arrowhead, used as a leader from a dot to its label."""
        self.items.append(dict(kind="line", x1=x1, y1=y1, x2=x2, y2=y2))

    def circle(self, x, y, r, style="", fill="#ffffff"):
        self.items.append(dict(kind="circle", x=x, y=y, r=r, style=style, fill=fill))

    # --- SVG --------------------------------------------------------------
    def svg(self) -> str:
        parts = [
            f'<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" '
            f'width="{self.w}" height="{self.h}"><defs><style class="style-fonts">{FONT_CSS}</style>'
            f'<marker id="head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="9" markerHeight="9" orient="auto">'
            f'<path d="M1 1 L9 5 L1 9" fill="none" stroke="{INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>',
            f'<rect x="0" y="0" width="{self.w}" height="{self.h}" fill="#ffffff"/>',
        ]
        for it in self.items:
            kind, style = it["kind"], it.get("style", "")
            dash = ' stroke-dasharray="9 7"' if style == "dashed" or it.get("dashed") else ""
            width = 3.2 if style == "bold" else 2
            common = f'stroke="{INK}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"{dash}'
            if kind == "box":
                x, y, w, h = it["x"], it["y"], it["w"], it["h"]
                parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="#ffffff" stroke="none"/>')
                parts.append(f'<path d="{rough_rect(x, y, w, h, self.rng)}" fill="none" {common}/>')
                if style == "bold":
                    parts.append(f'<path d="{rough_rect(x + 7, y + 7, w - 14, h - 14, self.rng, radius=11)}" fill="none" stroke="{INK}" stroke-width="1.6"/>')
            elif kind == "circle":
                parts.append(f'<circle cx="{it["x"]}" cy="{it["y"]}" r="{it["r"]}" fill="{it["fill"]}" stroke="none"/>')
                parts.append(f'<path d="{rough_circle(it["x"], it["y"], it["r"], self.rng)}" fill="none" {common}/>')
                if style == "bold":
                    parts.append(f'<path d="{rough_circle(it["x"], it["y"], it["r"] + 6, self.rng)}" fill="none" stroke="{INK}" stroke-width="1.6"/>')
            elif kind == "line":
                x1, y1, x2, y2 = it["x1"], it["y1"], it["x2"], it["y2"]
                mx, my = wobble(self.rng, (x1 + x2) / 2, 1.5), wobble(self.rng, (y1 + y2) / 2, 1.5)
                parts.append(f'<path d="M{x1} {y1} Q{mx:.1f} {my:.1f} {x2} {y2}" fill="none" stroke="{INK}" stroke-width="1.6" stroke-linecap="round"/>')
            elif kind == "arrow":
                x1, y1, x2, y2 = it["x1"], it["y1"], it["x2"], it["y2"]
                chord = math.hypot(x2 - x1, y2 - y1)
                sag = abs(it["bend"]) * chord
                radius = chord * chord / (8 * sag) + sag / 2 if sag else 1e6
                sweep = 0 if it["bend"] > 0 else 1
                parts.append(f'<path d="M{x1} {y1} A{radius:.1f} {radius:.1f} 0 0 {sweep} {x2} {y2}" fill="none" marker-end="url(#head)" {common}/>')
            else:
                lines = it["text"].split("\n")
                lh = it["size"] * it["lh"]
                top = it["y"] - (len(lines) * lh) / 2 if it["middle"] else it["y"]
                for n, line in enumerate(lines):
                    y = top + n * lh + it["size"] * 0.82
                    parts.append(
                        f'<text x="{it["x"]}" y="{y:.1f}" font-family="Excalifont, Xiaolai, Segoe UI Emoji" '
                        f'font-size="{it["size"]}px" fill="{it["color"]}" text-anchor="{it["anchor"]}" '
                        f'style="white-space: pre;">{escape(line)}</text>'
                    )
        parts.append("</svg>")
        return "".join(parts)

    # --- Excalidraw -------------------------------------------------------
    def excalidraw(self) -> dict:
        elements, n = [], 0

        def base(kind, x, y, w, h, style="", stroke=INK, fill="transparent"):
            nonlocal n
            n += 1
            return {
                "id": f"{self.name}-{n}", "type": kind, "x": x, "y": y, "width": w, "height": h, "angle": 0,
                "strokeColor": stroke, "backgroundColor": fill, "fillStyle": "solid",
                "strokeWidth": 4 if style == "bold" else 2, "strokeStyle": "dashed" if style == "dashed" else "solid",
                "roughness": 2, "opacity": 100, "groupIds": [], "frameId": None,
                "roundness": {"type": 3} if kind == "rectangle" else None, "seed": 1000 + n,
                "version": 1, "versionNonce": 2000 + n, "isDeleted": False, "boundElements": None,
                "updated": 1, "link": None, "locked": False, "index": f"a{n:03d}",
            }

        for it in self.items:
            kind, style = it["kind"], it.get("style", "")
            if kind == "box":
                elements.append(base("rectangle", it["x"], it["y"], it["w"], it["h"], style, fill="#ffffff"))
            elif kind == "circle":
                r = it["r"]
                elements.append(base("ellipse", it["x"] - r, it["y"] - r, 2 * r, 2 * r, style, fill=it["fill"]))
            elif kind == "line":
                e = base("line", it["x1"], it["y1"], abs(it["x2"] - it["x1"]), abs(it["y2"] - it["y1"]))
                e.update(points=[[0, 0], [it["x2"] - it["x1"], it["y2"] - it["y1"]]], lastCommittedPoint=None,
                         startBinding=None, endBinding=None, startArrowhead=None, endArrowhead=None)
                e["strokeWidth"] = 1
                elements.append(e)
            elif kind == "arrow":
                dx, dy = it["x2"] - it["x1"], it["y2"] - it["y1"]
                chord = math.hypot(dx, dy)
                sag = it["bend"] * chord
                mid = [dx / 2 - dy / chord * sag, dy / 2 + dx / chord * sag]
                e = base("arrow", it["x1"], it["y1"], abs(dx), abs(dy), "dashed" if it["dashed"] else "")
                e.update(points=[[0, 0], mid, [dx, dy]], lastCommittedPoint=None, startBinding=None, endBinding=None,
                         startArrowhead=None, endArrowhead="arrow", elbowed=False, roundness={"type": 2})
                elements.append(e)
            else:
                lines = it["text"].split("\n")
                width = max(len(line) for line in lines) * it["size"] * CHAR_WIDTH
                height = len(lines) * it["size"] * it["lh"]
                x = it["x"] - width / 2 if it["anchor"] == "middle" else (it["x"] - width if it["anchor"] == "end" else it["x"])
                y = it["y"] - height / 2 if it["middle"] else it["y"]
                e = base("text", x, y, width, height, stroke=it["color"])
                e.update(text=it["text"], originalText=it["text"], fontSize=it["size"], fontFamily=5,
                         textAlign={"middle": "center", "end": "right"}.get(it["anchor"], "left"), verticalAlign="top",
                         containerId=None, lineHeight=it["lh"], autoResize=True, roundness=None)
                elements.append(e)
        return {"type": "excalidraw", "version": 2, "source": "scripts/make-diagrams.py",
                "elements": elements, "appState": {"viewBackgroundColor": "#ffffff", "gridSize": None}}

    def save(self):
        (OUT_SVG / f"{self.name}.svg").write_text(self.svg(), encoding="utf-8")
        (OUT_SRC / f"{self.name}.excalidraw").write_text(json.dumps(self.excalidraw(), indent=2), encoding="utf-8")
        print("wrote", self.name)


# ---------------------------------------------------------------------------
def big_picture():
    d = Diagram("rag-big-picture", 1300, 600, "RAG in one picture: look it up first, then answer")
    steps = [
        ("1  Question", "Can I apply for\nre-evaluation 20\ndays after the\nresult?", ""),
        ("2  Search", "Look through the\nlibrary of exam\nrules for pages\nthat match", ""),
        ("3  Pick evidence", "Keep the best few.\nCurrent rule:\n15 days from\nthe result", "bold"),
        ("4  Model writes", "Reads the rule\nand the question,\nthen writes a\nreply", ""),
        ("5  Check", "Does the reply\nmatch the cited\nrule? Open [1]\nand compare", "dashed"),
    ]
    box_w, gap, x0 = 190, 62, 45
    for i, (head, body, style) in enumerate(steps):
        x = x0 + i * (box_w + gap)
        d.text(x + box_w / 2, 100, head, size=21, anchor="middle")
        d.box(x, 135, box_w, 170, body, size=17, style=style)
        if i < 4:
            d.arrow(x + box_w + 8, 220, x + box_w + gap - 8, 220, bend=-0.3)
    d.box(375, 385, 550, 96, "Library of exam rules\nrevaluation.md, supplementary.md, hours.md", size=19)
    d.arrow(650, 383, 340, 311, bend=0.2, dashed=True)
    d.text(650, 530, "Steps 2 and 3 are retrieval. Step 4 is generation. Step 5 is checking.", size=22, anchor="middle")
    d.save()


def embeddings():
    d = Diagram("embeddings-space", 1000, 680, "An embedding turns meaning into a position")
    cx, cy = 480, 340
    d.circle(cx, cy, 130, style="dashed")
    d.text(cx, cy - 112, "nearest\nneighbours", size=16, anchor="middle", color=SOFT)
    # the question, with its label outside the circle on the left
    d.circle(cx, cy, 9, fill=INK)
    d.line(cx - 12, cy, 345, cy)
    d.text(330, cy - 36, "Your question:\n\"check my paper again,\n3 weeks after the result\"", size=17, anchor="end")
    # the two nearby rules, labels outside the circle on the right
    d.circle(558, 300, 9, style="bold")
    d.arrow(cx + 12, cy - 8, 546, 306, bend=0.2)
    d.line(572, 295, 662, 270)
    d.text(676, 238, "Current rule:\nre-evaluation\nwithin 15 days", size=17)
    d.circle(562, 388, 9, style="dashed")
    d.line(576, 391, 662, 400)
    d.text(676, 384, "Archived rule:\nwithin 30 days", size=17)
    # far-away pages
    d.circle(220, 140, 9)
    d.text(244, 128, "Supplementary exams in July", size=17)
    d.circle(170, 580, 9)
    d.text(194, 570, "Hostel rooms", size=17)
    d.circle(830, 560, 9)
    d.text(806, 550, "Exam office hours", size=17, anchor="end")
    d.text(500, 630, "Close together means similar meaning. Search returns the points nearest the question.", size=19, anchor="middle")
    d.text(500, 662, "Real embeddings use hundreds of numbers, not two. This flat picture is only a cartoon of the idea.", size=16, anchor="middle", color=SOFT)
    d.save()


def keyword_vs_meaning():
    d = Diagram("keyword-vs-meaning", 1100, 680, "Same question, two kinds of search")
    d.text(550, 90, "\"Can I get my paper checked again if I ask three weeks after the result?\"", size=20, anchor="middle", color=SOFT)
    for x, title, a, b, verdict, style in (
        (40, "Keyword search: count shared words",
         "Question words:\npaper, checked, again,\nask, three, weeks, result",
         "Rule words:\napply, re-evaluation, 15,\ndays, result, declaration",
         "Shared words: only \"result\"\nScore 1. Not enough, so\nno evidence is sent.", "dashed"),
        (580, "Meaning search: compare embeddings",
         "\"checked again\"\nis close to\n\"re-evaluation\"",
         "\"three weeks\"\nis close to\n\"21 days\"",
         "Nearest page:\nexams/revaluation.md\nFound, in different words.", "bold"),
    ):
        d.box(x, 130, 480, 440, "", style=style)
        d.text(x + 240, 168, title, size=22, anchor="middle")
        d.box(x + 40, 205, 400, 100, a, size=18)
        d.box(x + 40, 325, 400, 100, b, size=18)
        d.text(x + 240, 470, verdict, size=19, anchor="middle", lh=1.4)
    d.text(550, 622, "The best systems run both and merge the two lists. That is called hybrid search.", size=21, anchor="middle")
    d.text(550, 656, "Keyword search wins on exact codes like ERR_404. Meaning search wins on rephrased questions.", size=17, anchor="middle", color=SOFT)
    d.save()


def rrf():
    d = Diagram("rrf-example", 1000, 680, "Merging two ranked lists with RRF (k = 60)")
    d.text(220, 100, "Meaning search says", size=22, anchor="middle")
    d.text(780, 100, "Keyword search says", size=22, anchor="middle")
    for i, name in enumerate(["revaluation.md", "supplementary.md", "office/hours.md"]):
        d.box(70, 130 + i * 70, 300, 54, f"{i + 1}.  {name}", size=19)
    for i, name in enumerate(["revaluation.md", "office/hours.md"]):
        d.box(630, 130 + i * 70, 300, 54, f"{i + 1}.  {name}", size=19)
    d.arrow(220, 340, 360, 418, bend=0.2)
    d.arrow(780, 270, 640, 418, bend=-0.2)
    d.box(200, 430, 600, 190, "", style="bold")
    d.text(500, 462, "Score = 1 / (60 + rank) from each list, added up", size=20, anchor="middle")
    d.text(500, 502, "revaluation.md      1/61 + 1/61 = 0.0328   1st", size=19, anchor="middle")
    d.text(500, 538, "office/hours.md     1/63 + 1/62 = 0.0320   2nd", size=19, anchor="middle")
    d.text(500, 574, "supplementary.md    1/62         = 0.0161   3rd", size=19, anchor="middle")
    d.text(500, 655, "A page that both searches like rises to the top. No score scaling needed.", size=20, anchor="middle")
    d.save()


def metrics():
    d = Diagram("metrics-example", 1140, 640, "Measuring search: where did the right page land?")
    d.text(570, 92, "Question: \"Can I apply for re-evaluation 20 days after the result?\"   Right page: revaluation.md", size=19, anchor="middle", color=SOFT)
    names = ["revaluation-2024.md", "office/hours.md", "revaluation.md", "supplementary.md", "hostel.md"]
    for i, name in enumerate(names):
        x = 40 + i * 212
        d.text(x + 100, 134, f"rank {i + 1}", size=19, anchor="middle")
        d.box(x, 160, 200, 80, name, size=17, style="bold" if name == "revaluation.md" else "")
    d.box(40, 290, 510, 250, "")
    d.text(295, 322, "One question", size=22, anchor="middle")
    for n, line in enumerate([
        "Hit@5: is the right page in the top 5?  Yes",
        "Recall@5: found 1 of 1 right pages = 1.00",
        "Precision@5: 1 right out of 5 shown = 0.20",
        "Reciprocal rank: 1 / 3 = 0.33",
    ]):
        d.text(65, 360 + n * 40, line, size=18)
    d.box(580, 290, 510, 250, "")
    d.text(835, 322, "Average over questions (MRR)", size=22, anchor="middle")
    for n, line in enumerate([
        "Question A: right page at rank 3 = 0.33",
        "Question B: right page at rank 1 = 1.00",
        "Question C: right page at rank 2 = 0.50",
        "MRR = (0.33 + 1.00 + 0.50) / 3 = 0.61",
    ]):
        d.text(605, 360 + n * 40, line, size=18)
    d.text(570, 590, "Higher is better for all four. Check recall first: a page that never shows up cannot be ranked.", size=20, anchor="middle")
    d.save()


def bad_cut():
    d = Diagram("bad-cut", 1000, 620, "Did the rule survive the cut?")
    d.text(500, 92, "Source: \"Students can apply for re-evaluation within 15 days of result declaration.\"", size=19, anchor="middle", color=SOFT)
    d.text(40, 138, "Bad cut: the subject is split from the number", size=23)
    d.box(40, 180, 420, 90, "Chunk A\n\"Students can apply\nfor re-evaluation\"", size=18, style="dashed")
    d.box(540, 180, 420, 90, "Chunk B\n\"within 15 days of\nresult declaration.\"", size=18, style="dashed")
    d.text(500, 218, "cut", size=19, anchor="middle", color=SOFT)
    d.text(500, 312, "Chunk B says 15 days, but 15 days of what? Search may never link it to re-evaluation.", size=19, anchor="middle")
    d.text(40, 382, "Good cut: the whole fact stays together", size=23)
    d.box(40, 425, 920, 100, "Chunk\n\"Students can apply for re-evaluation within 15 days of result declaration.\"", size=19, style="bold")
    d.text(500, 585, "Tip: print a few real chunks and read them. Each one should make sense on its own.", size=20, anchor="middle")
    d.save()


def running_example():
    d = Diagram("rag-running-example", 1000, 720, "A real citation can still point to the wrong rule")
    d.box(280, 90, 440, 84, "Can I apply for re-evaluation\nof my marks 20 days after the result?", size=20)
    d.box(60, 270, 380, 84, "Search without\na freshness filter", size=21)
    d.box(560, 270, 380, 84, "Search current\nrules only", size=21, style="bold")
    d.arrow(400, 180, 250, 262, bend=-0.15)
    d.arrow(600, 180, 750, 262, bend=0.15)
    d.box(60, 450, 380, 120, "[1] Archived 2024 rule\n30-day window\n20 days looks fine", size=21, style="dashed")
    d.box(560, 450, 380, 120, "[1] Current rule\n15-day window\n20 days is too late", size=21, style="bold")
    d.arrow(250, 360, 250, 442, bend=0.12)
    d.arrow(750, 360, 750, 442, bend=0.12)
    d.text(250, 625, "Plausible citation.\nWrong version.", size=25, anchor="middle")
    d.text(750, 625, "Current evidence.\nNow check the answer.", size=25, anchor="middle")
    d.save()


if __name__ == "__main__":
    for build in (big_picture, embeddings, keyword_vs_meaning, rrf, metrics, bad_cut, running_example):
        build()
