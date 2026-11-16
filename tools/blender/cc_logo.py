"""Continuous Civilization logo, rendered in Blender (no AI): an original 3D build of the author's Workshop design
(docs/images/workshop-preview.jpg) without the temple in the middle. The C is a plaster ceiling medallion coming off
the marble wall (sloped skirt, rounded rim, marble field, recessed navy band between gold beads, scroll ends, a leaf
point below), seen straight on; gold-stemmed laurels and an hourglass hexagon on the
wide bottom of the band; on the top half a skyline that grows from a castle with cypresses, a campanile and a domed
cathedral to a factory with chimneys and Art Deco towers; a gold arc with a star; the title below.
Buildings come from cc_kit.py (shared with the banner). Close Civ VII before rendering.

Run (headless):
  blender -b --factory-startup --python tools/blender/cc_logo.py -- --out <file.png> [--size 1024] [--samples 128]
"""
import argparse
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cc_kit as K  # noqa: E402
from cc_kit import M  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--size", type=int, default=1024)
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--font", default=r"C:\Windows\Fonts\PERTIBD.TTF")
args = ap.parse_args(argv)

scene = K.setup(args.size, args.size, args.samples, exposure=-0.15)
K.init_materials()
# The skyline is carved from the C: every building part in the C's own marble, openings as shadowed recesses, gold
# only for accents (the dome, spires, the flag).
M.recess = K.material("Carved recess", (0.42, 0.40, 0.37, 1), 0.7)
M.stone = M.stone_light = M.roof = M.tree = M.marble
M.glass = M.recess
M.bronze = M.gold
rng = random.Random(3)

# ---------------------------------------------------------------------------------------------------- the C
# A ceiling-medallion C coming off the marble wall, seen straight on. Its moulding profile, from the wall inward: a
# sloped skirt, a rounded outer rim bead, a flat marble field, a gold bead, the recessed navy band, a gold bead, and an
# inner lip sloping back to the wall inside the opening. On the top half the rim gives way to the skyline's floor.
R_O, R_M, R_I = 1.95, 1.08, 0.85          # outer rim, field/navy boundary, inner edge: a wide field for carving
A_TOP, A_BOT = 40.0, 320.0                # the C opens to the right
W = 0.28                                  # the wall's front surface (the C's back sits on it)
Y_BACK, Y_FRONT = 0.24, -0.29             # used by the skyline and emblem below
FIELD = -0.26                             # front of the flat marble field
NAVY_Y = -0.22                            # front of the navy band
R_FLOOR = R_O - 0.12                      # the buildings' floor on the top half: the rim gives way to the skyline
A_SKY = 154.0                             # the skyline covers the top of the C from its top end round to here
r_mid = lambda a: R_M
r_inner = lambda a: R_I

OUTER_FULL = [(R_O + 0.30, W), (R_O + 0.18, W - 0.1), (R_O + 0.11, 0.0), (R_O + 0.085, -0.22), (R_O + 0.06, -0.37),
              (R_O, -0.43), (R_O - 0.06, -0.37), (R_O - 0.085, -0.29), (R_O - 0.12, FIELD)]
OUTER_LOW = [(R_FLOOR + 0.22, W), (R_FLOOR + 0.12, W - 0.1), (R_FLOOR + 0.06, 0.02), (R_FLOOR + 0.035, -0.2),
             (R_FLOOR + 0.015, -0.25), (R_FLOOR - 0.005, FIELD - 0.005), (R_FLOOR - 0.03, FIELD), (R_FLOOR - 0.05, FIELD),
             (R_FLOOR - 0.07, FIELD)]
INNER = [(R_M + 0.04, FIELD), (R_M + 0.02, NAVY_Y + 0.02), (R_I + 0.02, NAVY_Y + 0.02), (R_I - 0.03, -0.24),
         (R_I - 0.07, -0.2), (R_I - 0.13, 0.05), (R_I - 0.2, W)]


def sky_blend(a):
    """0 under the skyline, 1 on the full medallion, with a smooth ramp."""
    t = min(max((a - A_SKY) / 14.0, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def profile(a):
    t = sky_blend(a)
    outer = [(lo[0] + (hi[0] - lo[0]) * t, lo[1] + (hi[1] - lo[1]) * t) for lo, hi in zip(OUTER_LOW, OUTER_FULL)]
    return outer + INNER


def rounded(pts, passes=3):
    """Round every corner of a profile (Chaikin), keeping its two wall feet in place."""
    for _ in range(passes):
        out = [pts[0]]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            out += [(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1), (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)]
        out.append(pts[-1])
        pts = out
    return pts


K.lathe("C medallion", lambda a: rounded(profile(a)), A_TOP, A_BOT, M.marble, smooth_angle=89.0)
K.band("C navy", lambda a: R_I + 0.02, lambda a: R_M - 0.02, A_TOP + 0.5, A_BOT - 0.5, NAVY_Y + 0.05, NAVY_Y,
       M.navy, bevel=0.008)
K.ring_bead("Gold bead mid", R_M, NAVY_Y - 0.01, 0.028, A_TOP, A_BOT, M.gold)
K.ring_bead("Gold bead inner", R_I, NAVY_Y - 0.01, 0.028, A_TOP, A_BOT, M.gold)

# ---- carved ornament on the marble field (white on white, like plaster relief) --------------------------------------
F_IN, F_OUT = R_M + 0.05, R_O - 0.12      # the field between the gold bead and the rim
RY = FIELD - 0.004                         # relief sits on the field


def polar(r, a_deg):
    return r * math.cos(math.radians(a_deg)), r * math.sin(math.radians(a_deg))


# Smooth rim mouldings like the reference: a thinner rounded ring just inside the thick outer rim.
K.ring_bead("Rim inner ring", F_OUT + 0.01, FIELD - 0.004, 0.034, A_SKY + 15, A_BOT - 2, M.marble)


def shell(am, spread=9.0, n=11):
    """A big ribbed shell fanning out from the field's inner edge toward the rim, with a scalloped edge, a knob at its
    base and a large scroll on each side of it."""
    bx, bz = polar(F_IN + 0.035, am)
    reach = F_OUT - F_IN - 0.05
    for k in range(n):
        off = k - (n - 1) / 2
        ang = am + off * spread
        length = reach * (1.0 - 0.28 * abs(off) / ((n - 1) / 2))
        K.rib("Shell rib", bx, bz, RY, ang, length, 0.05, M.marble, depth=0.045)
        tx, tz = bx + length * math.cos(math.radians(ang)), bz + length * math.sin(math.radians(ang))
        K.ellipsoid("Scallop", 0.045, 0.035, 0.045, tx, tz, RY - 0.006, M.marble)
    K.ellipsoid("Shell knob", 0.1, 0.06, 0.085, bx, bz, RY - 0.015, M.marble)
    for side in (-1, 1):
        sx, sz = polar(F_IN + 0.12, am + side * (spread * 0.9 + 3))
        K.spiral("Shell scroll", sx, sz, RY - 0.006, 0.14, 0.025, 1.7, 0.034, M.marble,
                 start_deg=am + 180 + side * 50, clockwise=(side > 0))


def leaf_cluster(am):
    """Three acanthus leaves fanning outward (with lobes along their edges) above two scrolls."""
    bx, bz = polar(F_IN + 0.03, am)
    for dang, length, width in ((0, 0.6, 0.1), (-30, 0.45, 0.085), (30, 0.45, 0.085)):
        ang = am + dang
        K.rib("Acanthus leaf", bx, bz, RY, ang, length, width, M.marble, depth=0.05)
        for j in (1, 2):                                    # lobes along both edges of the leaf
            px, pz = bx + length * 0.32 * j * math.cos(math.radians(ang)), bz + length * 0.32 * j * math.sin(math.radians(ang))
            for side in (-1, 1):
                K.rib("Leaf lobe", px, pz, RY - 0.006, ang + side * 48, 0.15 - 0.03 * j, 0.04, M.marble, depth=0.032)
    for side in (-1, 1):
        sx, sz = polar(F_IN + 0.1, am + side * 9)
        K.spiral("Leaf scroll", sx, sz, RY - 0.006, 0.13, 0.022, 1.6, 0.032, M.marble,
                 start_deg=am + 180 + side * 60, clockwise=(side < 0))


shell(225.0)                       # lower left, between the two leaf clusters
shell(298.0, spread=5.0, n=9)      # lower right, between the bottom cluster and the volute
leaf_cluster(180.0)                # left
leaf_cluster(270.0)                # bottom, above the leaf point
shell(128.0, spread=6.0, n=9)      # under the skyline: upper left
leaf_cluster(95.0)                 # under the skyline: top
shell(62.0, spread=5.0, n=9)       # under the skyline: upper right

# A scroll band along the field's inner edge, gently waving like the reference's scrollwork frame.
band_pts, a_ = [], A_TOP + 10
while a_ <= A_BOT - 10:
    r = F_IN + 0.025 + 0.018 * math.sin(math.radians((a_ - A_SKY) * 24))
    band_pts.append(polar(r, a_))
    a_ += 1.0
K.tube("Scroll band", band_pts, RY - 0.002, 0.026, M.marble)

# Spiral volutes at both ends of the C: a carved scroll winding in to a gold eye.
for a_end, cw in ((A_TOP, False), (A_BOT, True)):
    rc = (R_I + R_O) / 2
    cx, cz = polar(rc, a_end)
    boss = K.ycyl("Volute boss", 0.36, 0.45, cx, cz, -0.27, M.marble, seg=96)
    bev = boss.modifiers.new("Bevel", "BEVEL")
    bev.width = 0.06
    bev.segments = 4
    K.spiral("Volute", cx, cz, -0.31, 0.31, 0.055, 2.4, 0.05, M.marble, start_deg=a_end + 180, clockwise=cw)
    K.ellipsoid("Volute eye", 0.06, 0.04, 0.06, cx, cz, -0.35, M.gold)

# An acanthus point below the emblem: a pointed leaf with a gold vein, lobed sides and two curled side leaves.
TOP = -R_O + 0.08
leaf = [(0.0, TOP + 0.04), (0.17, TOP - 0.04), (0.19, TOP - 0.16), (0.13, TOP - 0.3), (0.06, TOP - 0.42),
        (0.0, TOP - 0.55), (-0.06, TOP - 0.42), (-0.13, TOP - 0.3), (-0.19, TOP - 0.16), (-0.17, TOP - 0.04)]
K.prism("Acanthus", leaf, W - 0.02, -0.3, M.marble, bevel=0.05)
K.prism("Acanthus vein", [(0.0, TOP - 0.06), (0.014, TOP - 0.26), (0.0, TOP - 0.48), (-0.014, TOP - 0.26)],
        -0.2, -0.37, M.gold, bevel=0.004)
for side in (-1, 1):
    for k in range(3):                                              # lobes along the leaf's edges
        K.rib("Lobe", side * (0.05 + 0.03 * k), TOP - 0.1 - 0.12 * k, -0.33, -90 + side * (55 - 8 * k), 0.13 - 0.025 * k,
              0.024, M.marble, depth=0.02)
    K.spiral("Acanthus curl", side * 0.27, TOP - 0.05, -0.31, 0.085, 0.015, 1.5, 0.022, M.marble,
             start_deg=(0 if side > 0 else 180) - 90, clockwise=(side < 0))

# ---------------------------------------------------------------------------------------------------- emblem, laurels
NAVY_FRONT = NAVY_Y
R_BAND = (r_mid(270) + r_inner(270)) / 2          # centre line of the bottom band
hx, hz = 0.0, -R_BAND
hexagon = [(hx + 0.17 * math.cos(math.radians(30 + 60 * i)), hz + 0.17 * math.sin(math.radians(30 + 60 * i))) for i in range(6)]
K.prism("Hex gold", hexagon, NAVY_FRONT + 0.04, NAVY_FRONT - 0.08, M.gold, bevel=0.012)
K.prism("Hex navy", [(hx + (x - hx) * 0.82, hz + (z - hz) * 0.82) for x, z in hexagon], NAVY_FRONT, NAVY_FRONT - 0.092, M.navy, bevel=0.006)
HY = NAVY_FRONT - 0.11
K.box("Hourglass cap top", 0.135, 0.018, 0.05, hx, hz + 0.078, HY, M.gold, bevel=0.005)
K.box("Hourglass cap bottom", 0.135, 0.018, 0.05, hx, hz - 0.096, HY, M.gold, bevel=0.005)
for side in (-1, 1):
    K.cyl("Hourglass post", 0.006, 0.156, hx + side * 0.057, hz - 0.078, HY + 0.025, M.gold, seg=8)
K.cyl("Glass top", 0.047, 0.074, hx, hz + 0.004, HY + 0.025, M.cream, seg=32, r_top=0.006)
K.cyl("Glass bottom", 0.006, 0.074, hx, hz - 0.078, HY + 0.025, M.cream, seg=32, r_top=0.047)
K.cyl("Sand", 0.034, 0.024, hx, hz - 0.078, HY + 0.025, M.gold, seg=32, r_top=0.02)

LEAF_Y = NAVY_FRONT - 0.02
for side in (-1, 1):
    a_start, a_end = 270 + side * 11, 270 + side * 52
    n = 9
    pts = []
    for i in range(n + 1):
        a = a_start + (a_end - a_start) * i / n
        r = R_BAND - 0.015 + 0.03 * math.sin(math.pi * i / n)       # the branch bows outward a little
        pts.append((r * math.cos(math.radians(a)), r * math.sin(math.radians(a))))
    for i in range(n):                                               # gold stem
        (x0, z0), (x1, z1) = pts[i], pts[i + 1]
        st = K.cyl("Stem", 0.008, math.hypot(x1 - x0, z1 - z0) + 0.01, 0, 0, 0, M.gold, seg=8)
        st.location = (x0, LEAF_Y + 0.01, z0)
        st.rotation_euler = (0, math.atan2(x1 - x0, z1 - z0), 0)
    for i in range(1, n + 1):                                        # cream leaves in pairs, smaller toward the tip
        (x0, z0), (x1, z1) = pts[i - 1], pts[min(i, n)]
        along = math.atan2(x1 - x0, z1 - z0)
        size = 1.0 - 0.45 * i / n
        for tilt in (-0.75, 0.75):
            leaf = K.ellipsoid("Leaf", 0.024 * size, 0.012, 0.075 * size, 0, 0, 0, M.cream)
            leaf.data.transform(__import__("mathutils").Matrix.Translation((0, 0, 0.068 * size)))
            leaf.location = (x0, LEAF_Y, z0)
            leaf.rotation_euler = (0, along + tilt * side * (1 if i % 2 else 0.85), 0)
    tip = K.ellipsoid("Leaf tip", 0.02, 0.012, 0.06, 0, 0, 0, M.cream)
    tip.data.transform(__import__("mathutils").Matrix.Translation((0, 0, 0.055)))
    tip.location = (pts[-1][0], LEAF_Y, pts[-1][1])
    tip.rotation_euler = (0, math.atan2(pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1]), 0)

# ---------------------------------------------------------------------------------------------------- skyline
# Upright buildings on the top half, each group on a base whose underside follows the C, so it grows out of it.
D = Y_BACK - Y_FRONT - 0.04         # as deep as the C
YF = FIELD - 0.02                    # fronts just in front of the marble field
R_BASE = R_FLOOR - 0.01               # buildings stand on the lowered top of the marble band


def on_top(x):
    """Ground level for a building at x: a curve inside the C's marble band."""
    return math.sqrt(max(R_BASE ** 2 - x ** 2, 0.0))


def ground(x0, x1, z_top, mat=None):
    """Marble filling the band up to the buildings' floor, so they grow out of the C itself."""
    under = [(x, math.sqrt(max((R_FLOOR - 0.1) ** 2 - x ** 2, 0.0))) for x in [x1 - (x1 - x0) * i / 24 for i in range(25)]]
    return K.prism("Base", [(x0, z_top), (x1, z_top)] + under, 0.1, YF, M.marble, bevel=0.01)


TURN = 15.0      # each building group is turned a little so its left side shows (still close to the C's face)


def group(x, z, build):
    return K.turned((x, YF + D / 2, z), TURN, build)


# Antiquity / medieval: a castle among cypresses.
z1 = on_top(-1.08) + 0.02
ground(-1.27, -0.84, z1)
group(-1.08, z1, lambda: K.castle(-1.08, z1, YF, D, 0.8))
# Renaissance: a campanile and a domed cathedral, then a row of houses.
z2 = on_top(-0.5) + 0.03
ground(-0.86, -0.2, z2, M.stone_light)
group(-0.76, z2, lambda: K.campanile(-0.76, z2, YF, D, 0.8))
group(-0.44, z2, lambda: K.dome_church(-0.44, z2, YF, D, 0.8))
z3 = on_top(-0.07) + 0.01
group(-0.07, z3, lambda: K.houses(-0.2, 0.06, z3, YF, D, 0.85, rng))
# Industrial: a factory with smoking chimneys.
z4 = on_top(0.32) + 0.02
ground(0.04, 0.6, z4)
group(0.32, z4, lambda: K.factory(0.32, z4, YF, D, 0.8))
K.smoke(0.29, z4 + 0.66, YF + 0.1, 1.0)
# Modern: Art Deco towers rising toward the C's top end.
for x, h in ((0.7, 0.8), (0.86, 1.0), (1.0, 0.62)):
    zt = on_top(x) + 0.01
    ground(x - 0.08, x + 0.08, zt, M.stone_light)
    group(x, zt, lambda x=x, zt=zt, h=h: K.deco_tower(x, zt, YF, D, 0.8, h))

# ---------------------------------------------------------------------------------------------------- arc, star, title
K.band("Orbit", lambda a: 3.0, lambda a: 3.02, 32, 148, 0.12, 0.08, M.gold, seg=240)
K.star("Star", 0.0, 3.01, 0.04, 0.26, M.gold)
K.text("Title", "CONTINUOUS", 0.62, 0.0, -3.08, 0.255, 0.03, M.navy, args.font, spacing=1.06)
K.text("Subtitle", "CIVILIZATION", 0.32, 0.0, -3.58, 0.26, 0.025, M.gold, args.font, spacing=1.4)
for side in (-1, 1):
    K.box("Rule", 0.7, 0.015, 0.02, side * 1.7, -3.59, 0.26, M.gold, bevel=0.0)

# ---------------------------------------------------------------------------------------------------- backdrop, light
K.prism("Wall", [(-7, -7), (7, -7), (7, 7), (-7, 7)], 0.35, W, M.wall)
world = __import__("bpy").data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.92, 0.89, 0.84, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.12
K.area_light("Key", (-4.5, -5.0, 5.5), 2.2, 1700, (1.0, 0.92, 0.80))
K.area_light("Fill", (5.0, -6.5, 0.5), 7.0, 220, (0.92, 0.95, 1.0))
K.area_light("Top", (0.0, -2.5, 6.5), 5.0, 220, (1.0, 0.96, 0.9))

bpy = __import__("bpy")
cam_data = bpy.data.cameras.new("Camera")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 8.0
cam = bpy.data.objects.new("Camera", cam_data)
K.COL.objects.link(cam)
cam.location = (0.0, -12.0, -0.25)
cam.rotation_euler = (math.radians(90), 0, 0)
scene.camera = cam
K.render(scene, args.out)
