"""Continuous Civilization logo, base shape (white plaster, no gold or navy yet), rendered in Blender (no AI).

Following the author's sketch over a ceiling-medallion photo: the medallion itself cut into a C. A plaster medallion
seen straight on (a skirt off the wall, a rounded outer rim with a thin ring inside it, a wide field carved with big
shells and acanthus leaf clusters, a raised inner frame with scrolls, an inner lip back to the wall), its right side
cut away with straight cuts into a big C opening; leaf points sticking out on the left and at the bottom; and a
skyline rising straight out of the rim on the top half, small on the left, tall towers on the right.
Buildings come from cc_kit.py. Close Civ VII before rendering.

Run (headless):
  blender -b --factory-startup --python tools/blender/cc_logo_base.py -- --out <file.png> [--size 1024] [--samples 128]
"""
import argparse
import math
import os
import random
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cc_kit as K  # noqa: E402
from cc_kit import M  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--size", type=int, default=1024)
ap.add_argument("--samples", type=int, default=128)
args = ap.parse_args(argv)

scene = K.setup(args.size, args.size, args.samples, exposure=-0.1)
K.init_materials()
PLASTER = K.material("Plaster", (0.86, 0.85, 0.83, 1), 0.6)
SHADOW = K.material("Recess", (0.42, 0.41, 0.40, 1), 0.8)
# Base pass: every part in plaster (gold and navy come later).
M.marble = M.stone = M.stone_light = M.roof = M.tree = M.bronze = M.gold = M.cream = PLASTER
M.glass = SHADOW
rng = random.Random(3)

# ---------------------------------------------------------------------------------------------------- the C
R_O, R_I = 1.95, 1.0            # outer rim, inner edge of the C
A_TOP, A_BOT = 38.0, 322.0      # straight cuts: the C opens to the right
W = 0.28                        # the wall's front surface
FIELD = -0.2                    # the carved field's surface


def rounded(pts, passes=3):
    """Round every corner of a profile (Chaikin), keeping its two wall feet in place."""
    for _ in range(passes):
        out = [pts[0]]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            out += [(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1), (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)]
        out.append(pts[-1])
        pts = out
    return pts


PROFILE = rounded([
    (R_O + 0.24, W), (R_O + 0.13, W - 0.1), (R_O + 0.08, 0.05),                       # skirt off the wall
    (R_O + 0.06, -0.15), (R_O + 0.03, -0.27), (R_O - 0.04, -0.32), (R_O - 0.11, -0.29), (R_O - 0.14, -0.24),  # rim
    (R_O - 0.16, -0.215), (R_O - 0.19, -0.235), (R_O - 0.22, -0.21),                  # thin ring inside the rim
    (R_O - 0.25, FIELD), ((R_O + R_I) / 2, FIELD + 0.012), (R_I + 0.17, FIELD),        # the field, gently dished
    (R_I + 0.14, -0.23), (R_I + 0.09, -0.26), (R_I + 0.04, -0.23),                    # raised inner frame
    (R_I + 0.01, -0.18), (R_I - 0.03, 0.0), (R_I - 0.09, W),                          # inner lip back to the wall
])
K.lathe("Medallion C", lambda a: PROFILE, A_TOP, A_BOT, PLASTER, smooth_angle=89.0)

F_IN, F_OUT = R_I + 0.17, R_O - 0.25      # the carved field (about half the C's width)
FW = F_OUT - F_IN
RY = FIELD - 0.003


def polar(r, a_deg):
    return r * math.cos(math.radians(a_deg)), r * math.sin(math.radians(a_deg))


def shell(am, scale=1.0, n=11, fan=62.0):
    """A big scallop shell: ribs fanning from a boss at the field's inner edge out to the rim, a scallop at each
    rib's tip."""
    bx, bz = polar(F_IN + 0.04, am)
    reach = (FW - 0.08) * scale
    for k in range(n):
        t = k / (n - 1) * 2 - 1                          # -1 .. 1 across the fan
        ang = am + t * fan
        length = reach * (1.0 - 0.18 * t * t)
        K.rib("Flute", bx, bz, RY, ang, length * 0.97, 0.052 * scale, PLASTER, depth=0.045)
    # The shell's scalloped rim: a smooth tube waving along the flutes' tips.
    rim = []
    for i in range(121):
        t = i / 120 * 2 - 1
        ang = am + t * fan
        length = reach * (1.0 - 0.18 * t * t) * (1.0 - 0.04 * abs(math.cos(math.pi * (t + 1) / 2 * (n - 1))))
        rim.append((bx + length * math.cos(math.radians(ang)), bz + length * math.sin(math.radians(ang))))
    K.tube("Shell rim", rim, RY - 0.004, 0.03 * scale, PLASTER)
    K.ellipsoid("Shell boss", 0.11 * scale, 0.07, 0.075 * scale, bx, bz, RY - 0.025, PLASTER)


def acanthus(am, scale=1.0):
    """An acanthus cluster: a tall central leaf and two side leaves, each with lobes along its edges."""
    bx, bz = polar(F_IN + 0.02, am)
    for dang, length, width in ((0, 1.0, 0.11), (-30, 0.82, 0.095), (30, 0.82, 0.095), (-62, 0.55, 0.08), (62, 0.55, 0.08)):
        ang, length = am + dang, length * (FW - 0.06) * scale
        K.rib("Acanthus", bx, bz, RY, ang, length, width * scale, PLASTER, depth=0.05)
        for j in (1, 2):
            px = bx + length * 0.3 * j * math.cos(math.radians(ang))
            pz = bz + length * 0.3 * j * math.sin(math.radians(ang))
            for side in (-1, 1):
                K.rib("Lobe", px, pz, RY - 0.008, ang + side * 45, (0.15 - 0.035 * j) * scale, 0.042 * scale, PLASTER,
                      depth=0.03)
    K.ellipsoid("Acanthus boss", 0.07 * scale, 0.06, 0.06 * scale, bx, bz, RY - 0.02, PLASTER)


def leaf_point(am, length=0.85, half=0.34):
    """A pointed acanthus leaf sticking out past the rim (like the medallion's points): serrated edges and a raised
    midrib, its base tucked under the rim."""
    ca, sa = math.cos(math.radians(am)), math.sin(math.radians(am))
    loc = lambda u, v: ((R_O + u) * ca - v * sa, (R_O + u) * sa + v * ca)     # u outward from the rim, v sideways
    u0 = -0.2
    edge = []
    for i in range(41):
        t = i / 40
        u = u0 + (length - u0) * t
        width = half * min(1.0, 0.55 + 2.5 * t) * (1 - t) ** 0.75
        notch = 0.78 + 0.22 * abs(math.cos(math.pi * t * 3.5))     # serrations: lobes along each side
        edge.append((u, width * notch))
    outline = [loc(u, v) for u, v in edge] + [loc(u, -v) for u, v in reversed(edge[1:-1])]
    K.prism("Leaf point", outline, W - 0.02, -0.25, PLASTER, bevel=0.05)
    K.rib("Point midrib", *loc(u0 + 0.12, 0), -0.28, am, length - u0 - 0.2, 0.045, PLASTER, depth=0.04)
    for k in range(4):                                             # side veins into the lobes
        u = 0.02 + 0.16 * k
        for side in (-1, 1):
            K.rib("Point vein", *loc(u, 0), -0.27, am + side * 50, half * (0.8 - 0.17 * k), 0.022, PLASTER, depth=0.02)


# Like the reference: acanthus on the axes (with points beyond the rim on the left and at the bottom), big shells on
# the diagonals, smaller shells toward the C's ends.
acanthus(90.0)
acanthus(180.0)
acanthus(270.0)
shell(135.0)
shell(225.0)
shell(62.0, scale=0.85, n=9, fan=55.0)
shell(298.0, scale=0.85, n=9, fan=55.0)
leaf_point(180.0)
leaf_point(270.0)
# A small bead between neighbouring motifs.
for am in (76.0, 112.5, 157.5, 202.5, 247.5, 284.0):
    K.ellipsoid("Bead", 0.045, 0.04, 0.045, *polar((F_IN + F_OUT) / 2, am), RY - 0.01, PLASTER)

# ---------------------------------------------------------------------------------------------------- skyline
# Buildings rising straight out of the rim on the top half, small on the left to tall towers on the right, each
# group turned a little so its side shows; the same plaster as the medallion.
D = 0.3
YF = -0.3
TURN = 15.0


def on_rim(x):
    return math.sqrt(max((R_O - 0.08) ** 2 - x ** 2, 0.0))


def ground(x0, x1, z_top):
    under = [(x, on_rim(x) - 0.08) for x in [x1 - (x1 - x0) * i / 24 for i in range(25)]]
    return K.prism("Base", [(x0, z_top), (x1, z_top)] + under, 0.15, YF, PLASTER, bevel=0.012)


def group(x, z, build):
    return K.turned((x, YF + D / 2, z), TURN, build)


z1 = on_rim(-1.2)
ground(-1.4, -1.0, z1)
group(-1.2, z1, lambda: K.castle(-1.2, z1, YF, D, 0.9))
z2 = on_rim(-0.62) + 0.02
ground(-0.95, -0.3, z2)
group(-0.85, z2, lambda: K.campanile(-0.85, z2, YF, D, 1.0))
group(-0.52, z2, lambda: K.dome_church(-0.52, z2, YF, D, 0.95))
z3 = on_rim(-0.1) + 0.02
ground(-0.3, 0.1, z3)
group(-0.1, z3, lambda: K.houses(-0.26, 0.06, z3, YF, D, 0.95, rng))
z4 = on_rim(0.38) + 0.02
ground(0.12, 0.64, z4)
group(0.38, z4, lambda: K.factory(0.38, z4, YF, D, 0.95))
K.smoke(0.35, z4 + 0.8, YF + 0.1, 1.1)
for x, h in ((0.82, 1.0), (1.0, 1.25), (1.18, 0.85)):
    zt = on_rim(x) + 0.01
    ground(x - 0.09, x + 0.09, zt)
    group(x, zt, lambda x=x, zt=zt, h=h: K.deco_tower(x, zt, YF, D, 0.95, h))

# ---------------------------------------------------------------------------------------------------- backdrop, light
K.prism("Wall", [(-8, -8), (8, -8), (8, 8), (-8, 8)], 0.35, W, M.wall)
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.92, 0.9, 0.86, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.15
K.area_light("Key", (-4.5, -5.0, 5.5), 2.5, 1800, (1.0, 0.95, 0.88))
K.area_light("Fill", (5.0, -6.5, 0.5), 7.0, 300, (0.93, 0.95, 1.0))
K.area_light("Top", (0.0, -2.5, 6.5), 5.0, 180, (1.0, 0.97, 0.92))

cam_data = bpy.data.cameras.new("Camera")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 6.6
cam = bpy.data.objects.new("Camera", cam_data)
K.COL.objects.link(cam)
cam.location = (-0.1, -12.0, 0.15)
cam.rotation_euler = (math.radians(90), 0, 0)
scene.camera = cam
K.render(scene, args.out)
