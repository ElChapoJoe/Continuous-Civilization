"""Continuous Civilization banner, rendered in Blender (no AI): the logo's skyline spread out across a wide banner, no
logo. White plaster buildings on a plaster ledge grow from left to right, Antiquity to the modern age; the slogan sits
below in the logo's font, all on the logo's marble, seen straight on like the logo.

Sculpted buildings (GLBs, kept out of the repo) are passed like the logo's; without one, that building comes from
cc_kit.py. Close Civ VII before rendering.

Run (headless):
  blender -b --factory-startup --python tools/blender/cc_banner.py -- --out <file.png> [--castle/--tower/--dome/
         --houses/--factory <glb>] [--marble <folder> --marble-raw --marble-size 9 --marble-place U V DEG] [--sun 4]
         [--width 1920] [--height 560] [--samples 128] [--slogan "..."]
"""
import argparse
import math
import os
import random
import sys

import bpy
import mathutils
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cc_kit as K  # noqa: E402
from cc_kit import M  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--width", type=int, default=1920)
ap.add_argument("--height", type=int, default=None, help="default 480 for the banner, 200 for the slogan")
ap.add_argument("--samples", type=int, default=128)
ap.add_argument("--mode", default="banner", choices=("banner", "slogan", "card"),
                help="banner: the city on its gold line; slogan: a strip with only the slogan, to go under it; "
                     "card: the banner with the slogan below, as a 16:9 title card")
ap.add_argument("--slogan", default="ONE CIVILIZATION \u00b7 ONE TIMELINE \u00b7 NO FORCED AGE TRANSITIONS")
ap.add_argument("--font", default=r"C:\Windows\Fonts\PERTIBD.TTF")
for b in ("castle", "tower", "dome", "houses", "factory"):
    ap.add_argument("--" + b)
ap.add_argument("--marble", help="folder of a photo-scanned marble texture set (kept out of the repo)")
ap.add_argument("--marble-raw", action="store_true", help="use the marble photo's own colours")
ap.add_argument("--marble-size", type=float, default=9.0)
ap.add_argument("--marble-place", type=float, nargs=3, default=(0.37, 0.21, 0.0), metavar=("U", "V", "DEG"))
ap.add_argument("--sun", type=float, default=0.0, help="strength of a low sun from the upper left")
ap.add_argument("--glow", type=float, default=0.0, help="power of a warm sunset glow on the wall behind the city")
ap.add_argument("--front", type=float, default=1.0, help="scales the front lamps")
args = ap.parse_args(argv)
if args.height is None:
    args.height = {"banner": 480, "slogan": 200, "card": 1080}[args.mode]

scene = K.setup(args.width, args.height, args.samples, exposure=-0.1)
K.init_materials()
PLASTER = K.material("Plaster", (0.86, 0.85, 0.83, 1), 0.6)
NAVY, GOLD = M.navy, M.gold
M.marble = M.stone = M.stone_light = M.roof = M.tree = M.bronze = M.gold = M.cream = PLASTER
M.glass = K.material("Recess", (0.42, 0.41, 0.40, 1), 0.8)
rng = random.Random(5)

W = 1.0                     # the wall's front: far enough back for the sculpted buildings' full depth
YF, D = 0.0, 0.28           # the buildings' front and depth
GROUND = 0.0                # the ledge's top, where the buildings stand
TURN = 15.0


def verts(ob):
    co = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    mw = np.array(ob.matrix_world)
    return co @ mw[:3, :3].T + mw[:3, 3]


def place_model(path, x, width):
    """Import a building GLB, scale it to width, turn it like the logo's buildings and stand it on the ledge at x, its
    base's front at YF."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = mw
        if o.name not in K.COL.objects:
            K.COL.objects.link(o)
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o)
    bpy.context.view_layer.update()
    pts = np.vstack([verts(o) for o in meshes])
    lo, hi = pts.min(0), pts.max(0)
    s = width / (hi[0] - lo[0])
    ctr = (lo + hi) / 2
    m = mathutils.Matrix.Rotation(math.radians(TURN), 4, "Z") @ mathutils.Matrix.Scale(s, 4) @ \
        mathutils.Matrix.Translation((-ctr[0], -ctr[1], -lo[2]))
    for o in meshes:
        o.matrix_world = m @ o.matrix_world
        o.data.materials.clear()
        o.data.materials.append(PLASTER)
        for p in o.data.polygons:
            p.use_smooth = True
    bpy.context.view_layer.update()
    pts = np.vstack([verts(o) for o in meshes])
    base = pts[pts[:, 2] < 0.04]
    shift = mathutils.Matrix.Translation((x, YF + 0.004 - base[:, 1].min(), GROUND))
    for o in meshes:
        o.matrix_world = shift @ o.matrix_world
    return (hi[2] - lo[2]) * s


def building(key, x, width, kit_build):
    if getattr(args, key, None):
        return place_model(getattr(args, key), x, width)
    K.turned((x, YF + D / 2, GROUND), TURN, lambda: kit_build(x, GROUND))
    return None


if args.mode in ("banner", "card"):
    # ---------------------------------------------------------------------------------------------------- the gold line and star
    # The logo's gold arc, straightened: a fine gold line left to right that the city stands on, the star at its middle.
    L0, L1 = -4.4, 4.4
    K.box("Gold line", L1 - L0, 0.04, W - YF + 0.02, 0, GROUND - 0.04, YF - 0.02, GOLD, bevel=0.006)
    K.star("Star", 0.0, GROUND - 0.02, YF - 0.1, 0.38, GOLD, depth=0.1)

    # ---------------------------------------------------------------------------------------------------- the city, left to right
    S = 1.6                     # the kit buildings' scale
    # Antiquity to the Renaissance on the left of the star, industry to the modern age on its right.
    building("castle", -3.75, 0.95, lambda x, z: K.castle(x, z, YF, D, S))
    building("tower", -2.95, 0.42, lambda x, z: K.campanile(x, z, YF, D, S))
    building("dome", -2.15, 0.9, lambda x, z: K.dome_church(x, z, YF, D, S))
    building("houses", -1.1, 0.95, lambda x, z: K.houses(x - 0.45, x + 0.45, z, YF, D, S, rng))
    fh = building("factory", 0.95, 0.9, lambda x, z: K.factory(x, z, YF, D, S))
    K.smoke(0.9, GROUND + (fh or 1.1) - 0.05, YF + 0.12, 1.6)
    for x, h in ((1.75, 0.78), (2.05, 0.98), (2.35, 0.72)):          # Art Deco towers
        K.turned((x, YF + D / 2, GROUND), TURN, lambda x=x, h=h: K.deco_tower(x, GROUND, YF, D, S, h))
    for x, h, w in ((2.75, 0.62, 0.13), (3.05, 0.8, 0.14), (3.35, 0.58, 0.12), (3.68, 0.92, 0.15), (4.02, 0.7, 0.13)):
        K.turned((x, YF + D / 2, GROUND), TURN, lambda x=x, h=h, w=w: K.modern_tower(x, GROUND, YF, D, S, h, w))



if args.mode in ("slogan", "card"):
    # ---------------------------------------------------------------------------------------------------- slogan
    MATTE_NAVY = K.material("Matte navy", (0.008, 0.02, 0.075, 1), 0.75)     # no sheen, so it stays dark and readable
    K.text("Slogan", args.slogan, 0.17, 0.0, 0.0 if args.mode == "slogan" else -0.95, W - 0.01, 0.012, MATTE_NAVY,
           args.font, spacing=1.12)
if args.mode == "card":
    # The name above the city, as on the logo: CONTINUOUS in navy, CIVILIZATION in gold between gold rules.
    K.text("Title", "CONTINUOUS", 0.58, 0.0, 2.88, W - 0.02, 0.025, MATTE_NAVY, args.font, spacing=1.06)
    K.text("Subtitle", "CIVILIZATION", 0.3, 0.0, 2.4, W - 0.02, 0.02, GOLD, args.font, spacing=1.4)
    for side in (-1, 1):
        K.box("Rule", 0.62, 0.014, 0.02, side * 1.75, 2.39, W - 0.03, GOLD, bevel=0.0)

# ---------------------------------------------------------------------------------------------------- backdrop, light
if args.marble:
    def texture_file(folder, *keys):
        for key in keys:
            hits = [f for f in os.listdir(folder) if key in f.lower() and f.lower().endswith((".jpg", ".png"))]
            if hits:
                return os.path.join(folder, hits[0])
        return None
    wall_mat = K.photo_marble("Wall photo marble", texture_file(args.marble, "basecolor", "_color"),
                              texture_file(args.marble, "roughness"), texture_file(args.marble, "normalgl", "_normal"),
                              size=args.marble_size, gold=False, raw=args.marble_raw,
                              offset=args.marble_place[:2], rot=args.marble_place[2])
else:
    wall_mat = M.wall
K.prism("Wall", [(-9, -6), (9, -6), (9, 6), (-9, 6)], W + 0.07, W, wall_mat)
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.92, 0.9, 0.86, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.15
lamp_scale = (0.55 if args.sun else 1.0) * args.front
K.area_light("Key", (-2.5, -9.0, 3.2), 5.0, 1500 * lamp_scale, (1.0, 0.95, 0.88), target=(0, 0, 0.4))   # behind the camera
K.area_light("Fill", (6.0, -6.5, 0.8), 8.0, 300 * lamp_scale, (0.93, 0.95, 1.0), target=(0, 0, 0.6))
K.area_light("Top", (0.0, -2.5, 6.0), 8.0, 260 * lamp_scale, (1.0, 0.97, 0.92), target=(0, 0, 0.6))
if args.sun:
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = args.sun
    sun.angle = math.radians(2.5)
    sun.color = (1.0, 0.95, 0.88)
    sun_ob = bpy.data.objects.new("Sun", sun)
    K.COL.objects.link(sun_ob)
    # From behind the camera, a little left and above: shadows fall back onto the wall, not over the slogan.
    sun_ob.rotation_euler = mathutils.Vector((0.3, 0.9, -0.3)).normalized().to_track_quat("-Z", "Y").to_euler()

if args.glow and args.mode in ("banner", "card"):
    # A sunrise behind the city: a wide orange oval on the wall, centred on the gold line, fading smoothly upward.
    K.add_wall_glow(wall_mat, 0.0, GROUND, 5.4, 2.6, 0.55, args.glow)
cam_data = bpy.data.cameras.new("Camera")
cam_data.type = "ORTHO"
cam_data.ortho_scale = 9.6                      # the banner's width; its height follows from the aspect
cam = bpy.data.objects.new("Camera", cam_data)
K.COL.objects.link(cam)
frame_h = 9.6 * args.height / args.width
cam.location = (0.0, -12.0, {"banner": frame_h / 2 - 0.53, "slogan": 0.0, "card": 0.85}[args.mode])  # banner: ends below the star
cam.rotation_euler = (math.radians(90), 0, 0)
scene.camera = cam
K.render(scene, args.out)
