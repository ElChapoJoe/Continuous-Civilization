"""Draw the Continuous Civilization logo: a gold serif C inside a laurel wreath.

Writes docs/images/logo.svg (scalable, for GitHub) and docs/images/logo-shapes.json, which
tools/render_logo.ps1 turns into the 1024 x 1024 Workshop preview. All shapes are computed here, so the
SVG and the raster image match.

    python -I tools/make_logo.py
"""
import json, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "docs", "images")
SIZE = 1024
CX, CY, R = 512.0, 530.0, 352.0          # wreath circle
LEAVES = 12                              # leaves per branch
START, END = 252.0, 118.0                # left branch angles (deg, maths convention, y up); right is mirrored


def pt(a_deg, r=R):
    a = math.radians(a_deg)
    return CX + r * math.cos(a), CY - r * math.sin(a)


def leaf(base, direction_deg, length, width, n=18):
    """Pointed oval leaf from base along direction (screen degrees, 0 = right, clockwise positive)."""
    d = math.radians(direction_deg)
    ux, uy = math.cos(d), math.sin(d)
    nx, ny = -uy, ux
    side1, side2 = [], []
    for i in range(n + 1):
        t = i / n
        half = width / 2 * math.sin(math.pi * t) ** 0.75
        cx, cy = base[0] + ux * length * t, base[1] + uy * length * t
        side1.append((cx + nx * half, cy + ny * half))
        side2.append((cx - nx * half, cy - ny * half))
    return side1 + side2[::-1][1:-1]


def branch(mirror):
    leaves, stem = [], []
    steps = 60
    for i in range(steps + 1):
        a = START + (END - START) * i / steps
        x, y = pt(a)
        stem.append((SIZE - x if mirror else x, y))
    for k in range(LEAVES):
        f = (k + 0.6) / LEAVES
        a = START + (END - START) * f
        base = pt(a)
        # growth direction: tangent toward the top of the wreath (screen coordinates)
        ta = math.radians(a - 90)            # clockwise tangent in maths coords for a decreasing angle
        tx, ty = math.cos(ta), -math.sin(ta)
        tang = math.degrees(math.atan2(ty, tx))
        size = 1.0 - 0.38 * f                # leaves get smaller toward the tip
        length, width = 118 * size, 44 * size
        for side in (-1, 1):                 # a pair: one outside the stem, one inside
            spread = 38 if side == 1 else 30
            lf = leaf(base, tang + side * spread, length, width)
            if mirror:
                lf = [(SIZE - x, y) for x, y in lf]
            leaves.append(lf)
    # tip leaf
    tip = pt(END)
    ta = math.radians(END - 90)
    tang = math.degrees(math.atan2(-math.sin(ta), math.cos(ta)))
    lf = leaf(tip, tang, 86, 34)
    if mirror:
        lf = [(SIZE - x, y) for x, y in lf]
    leaves.append(lf)
    return stem, leaves


shapes = {"size": SIZE, "stems": [], "leaves": [],
          "letter": {"text": "C", "font": "Georgia", "size": 470, "cx": CX - 6, "cy": CY - 8}}
for mirror in (False, True):
    stem, leaves = branch(mirror)
    shapes["stems"].append(stem)
    shapes["leaves"] += leaves

r = lambda v: round(v, 1)
with open(os.path.join(OUT, "logo-shapes.json"), "w", encoding="utf-8") as f:
    json.dump({**shapes, "stems": [[[r(x), r(y)] for x, y in s] for s in shapes["stems"]],
               "leaves": [[[r(x), r(y)] for x, y in l] for l in shapes["leaves"]]}, f)

poly = lambda pts: " ".join(f"{r(x)},{r(y)}" for x, y in pts)
L = shapes["letter"]
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" viewBox="0 0 {SIZE} {SIZE}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="46%" r="70%">
      <stop offset="0" stop-color="#232a3b"/><stop offset="1" stop-color="#0c0f17"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6df98"/><stop offset="0.55" stop-color="#d6a84f"/><stop offset="1" stop-color="#a8762a"/>
    </linearGradient>
  </defs>
  <rect width="{SIZE}" height="{SIZE}" fill="url(#bg)"/>
  <g fill="none" stroke="url(#gold)" stroke-width="7" stroke-linecap="round">
{chr(10).join(f'    <polyline points="{poly(s)}"/>' for s in shapes["stems"])}
  </g>
  <g fill="url(#gold)" stroke="#7d561c" stroke-width="2" stroke-linejoin="round">
{chr(10).join(f'    <polygon points="{poly(l)}"/>' for l in shapes["leaves"])}
  </g>
  <text x="{r(L["cx"])}" y="{r(L["cy"])}" text-anchor="middle" dominant-baseline="central" font-family="Georgia, 'Times New Roman', serif"
        font-weight="bold" font-size="{L["size"]}" fill="url(#gold)" stroke="#7d561c" stroke-width="3">C</text>
</svg>
'''
with open(os.path.join(OUT, "logo.svg"), "w", encoding="utf-8", newline="\n") as f:
    f.write(svg)
print("logo.svg and logo-shapes.json written,", len(shapes["leaves"]), "leaves")
