"""Continuous Civilization logo from a sculpted medallion model: the medallion cut into a C, a skyline rising from
its rim (small on the left, tall towers on the right). White plaster pass (gold and navy come later).

The medallion is the author's own Meshy generation (a GLB, kept out of the repo: pass its path with --model). It is
expected face-on to -Y with a flat back, centred on the origin, as Meshy exports it.
Close Civ VII before rendering.

Run (headless):
  blender -b --factory-startup --python tools/blender/cc_logo_medallion.py -- --model <medallion.glb> --out <file.png>
          [--size 1024] [--samples 128]
"""
import argparse
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cc_kit as K  # noqa: E402
from cc_kit import M  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--model", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--size", type=int, default=1024)
ap.add_argument("--samples", type=int, default=128)
# Optional sculpted building models (GLBs, kept out of the repo); without one, that building comes from cc_kit.py.
for b in ("castle", "tower", "dome", "houses", "factory"):
    ap.add_argument("--" + b)
ap.add_argument("--font", default=r"C:\Windows\Fonts\PERTIBD.TTF")
ap.add_argument("--plain", action="store_true", help="white plaster only (no navy or gold)")
ap.add_argument("--all-gold", action="store_true", help="the C and the skyline entirely in gold")
ap.add_argument("--gold-city", action="store_true", help="the skyline in gold")
ap.add_argument("--gold-tips", action="store_true", help="gold dome, spires and flag on the white skyline")
ap.add_argument("--marble", help="folder of a photo-scanned marble texture set (*_Color.jpg, *_Roughness.jpg, *_NormalGL.jpg); "
                "kept out of the repo. With it the wall is that marble, white with grey and some gilded veins")
ap.add_argument("--marble-gold", action="store_true", help="gold veins through the photo marble")
ap.add_argument("--arc", action="store_true", help="the gold arc and star over the skyline")
ap.add_argument("--glow", type=float, default=0.0, help="a sunrise glow on the wall behind the skyline (as on the banner)")
ap.add_argument("--sun", type=float, default=0.0, help="strength of a low sun from the upper left that casts crisp shadows")
ap.add_argument("--marble-raw", action="store_true", help="use the marble photo's own colours (no retint)")
ap.add_argument("--marble-size", type=float, default=11.0, help="how wide one tile of the marble texture is")
ap.add_argument("--marble-place", type=float, nargs=3, default=(0.37, 0.21, 0.0), metavar=("U", "V", "DEG"),
                help="the marble texture's offset and rotation (pick one that keeps the area behind the title clean)")
ap.add_argument("--wall", default="goldvein", choices=("goldvein", "cream", "calacatta", "taupe", "grey"),
                help="the marble behind the logo")
ap.add_argument("--c-gold", default="none", choices=("none", "ornaments", "carving"),
                help="gold on the C: none (all white), the axis ornaments and points, or all of the carving")
ap.add_argument("--gold-carving", action="store_true", help="all of the medallion's carving gilded, not only the axis ornaments")
args = ap.parse_args(argv)

scene = K.setup(args.size, args.size, args.samples, exposure=-0.1)
K.init_materials()
PLASTER = K.material("Plaster", (0.86, 0.85, 0.83, 1), 0.6)
SHADOW = K.material("Recess", (0.42, 0.41, 0.40, 1), 0.8)
GOLD, NAVY = M.gold, M.navy
M.marble = M.stone = M.stone_light = M.roof = M.tree = M.bronze = M.gold = M.cream = PLASTER
M.glass = SHADOW
rng = random.Random(3)

W = 0.28                    # the wall's front surface
R_RIM = 1.9                 # the medallion's outer rim radius after scaling
A_TOP, A_BOT = 38.0, 322.0  # straight cuts: the C opens to the right
HOLE = 0.42                 # the C's inner opening, as a fraction of the rim radius

# ---------------------------------------------------------------------------------------------------- medallion
bpy.ops.import_scene.gltf(filepath=args.model)
med = next(o for o in bpy.context.selected_objects if o.type == "MESH")
for o in list(bpy.context.selected_objects):
    if o is not med and o.type != "MESH":
        bpy.data.objects.remove(o)
med.parent = None
if med.name not in K.COL.objects:
    K.COL.objects.link(med)


def verts(ob):
    co = np.empty(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    mw = np.array(ob.matrix_world)
    return co @ mw[:3, :3].T + mw[:3, 3]


v = verts(med)
ang = np.degrees(np.arctan2(v[:, 2], v[:, 0])) % 360
rad = np.hypot(v[:, 0], v[:, 2])
diag = np.zeros(len(v), bool)
for a in (45, 135, 225, 315):           # between the leaf points, the rim is the outer edge
    diag |= np.abs(ang - a) < 3
r_rim = rad[diag].max()
s = R_RIM / r_rim
y_back = v[:, 1].max()
med.matrix_world = __import__("mathutils").Matrix.Translation((0, W - y_back * s, 0)) @ \
    __import__("mathutils").Matrix.Scale(s, 4) @ med.matrix_world
bpy.context.view_layer.update()
v = verts(med)
rad = np.hypot(v[:, 0], v[:, 2])
near_rim = diag & (rad > R_RIM - 0.25)
Y_RIM = v[near_rim, 1].min()            # the rim's front
print("MEDALLION scale %.3f, rim front %.3f, depth %.3f..%.3f" % (s, Y_RIM, v[:, 1].min(), v[:, 1].max()))
med.data.materials.clear()
med.data.materials.append(PLASTER)
for p in med.data.polygons:
    p.use_smooth = True


def cutter(name, outline):
    return K.prism(name, outline, 1.5, -1.5, PLASTER)


def arc(r, a0, a1, n=96):
    return [(r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), r * math.sin(math.radians(a0 + (a1 - a0) * i / n)))
            for i in range(n + 1)]


# The C: the centre hole plus a wedge opening to the right, as one cutter.
r_hole = R_RIM * HOLE
c_cut = arc(r_hole, A_TOP, A_BOT) + [(5 * math.cos(math.radians(A_BOT)), 5 * math.sin(math.radians(A_BOT))),
                                    (5, 0), (5 * math.cos(math.radians(A_TOP)), 5 * math.sin(math.radians(A_TOP)))]
# The top leaf point gives way to the skyline.
top_cut = arc(R_RIM - 0.02, 70, 110, 24) + arc(5, 110, 70, 24)
for name, outline in (("C cut", c_cut), ("Top point cut", top_cut)):
    cut = cutter(name, outline)
    mod = med.modifiers.new(name, "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cut
    mod.solver = "EXACT"
    mod.use_hole_tolerant = True
    bpy.context.view_layer.objects.active = med
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cut)
print("CUT faces", len(med.data.polygons))


def smooth(e0, e1, t):
    u = np.clip((t - e0) / (e1 - e0), 0, 1)
    return u * u * (3 - 2 * u)


_PAINTED = None


def painted_material():
    """White plaster mixed to gold by the vertex colour "paint" (its green channel)."""
    global _PAINTED
    if _PAINTED is None:
        mat = bpy.data.materials.new("Plaster and gold")
        mat.use_nodes = True
        nt = mat.node_tree
        white = nt.nodes["Principled BSDF"]
        white.inputs["Base Color"].default_value = (0.86, 0.85, 0.83, 1)
        white.inputs["Roughness"].default_value = 0.6
        gilt = nt.nodes.new("ShaderNodeBsdfPrincipled")
        gilt.inputs["Base Color"].default_value = (0.86, 0.63, 0.27, 1)
        gilt.inputs["Roughness"].default_value = 0.3
        gilt.inputs["Metallic"].default_value = 1.0
        at = nt.nodes.new("ShaderNodeAttribute")
        at.attribute_name = "paint"
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(at.outputs["Color"], sep.inputs[0])
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(sep.outputs[1], mix.inputs[0])
        nt.links.new(white.outputs[0], mix.inputs[1])
        nt.links.new(gilt.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
        _PAINTED = mat
    return _PAINTED


def set_gold(ob, gold):
    col = np.zeros((len(ob.data.vertices), 4))
    col[:, 1], col[:, 3] = gold, 1
    attr = ob.data.color_attributes.new("paint", "FLOAT_COLOR", "POINT")
    attr.data.foreach_set("color", col.ravel())
    ob.data.materials.clear()
    ob.data.materials.append(painted_material())


def gild_medallion(ob):
    """Gold on whole ornaments only: the leaf points beyond the rim and the scroll-and-acanthus clusters on the
    medallion's axes (left, bottom, and the top one under the skyline). The rim, shells and field stay white."""
    me = ob.data
    v = verts(ob)
    nrm = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("normal", nrm)
    nrm = nrm.reshape(-1, 3) @ np.array(ob.matrix_world)[:3, :3].T
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-9
    r = np.hypot(v[:, 0], v[:, 2])
    ang = np.degrees(np.arctan2(v[:, 2], v[:, 0])) % 360
    y = v[:, 1]
    front = nrm[:, 1] < -0.15
    # How far each point stands out of the deepest front surface around it (raised carving vs background).
    cell = 0.035
    n = int(4.6 / cell) + 1
    ix = np.clip(((v[:, 0] + 2.3) / cell).astype(int), 0, n - 1)
    iz = np.clip(((v[:, 2] + 2.3) / cell).astype(int), 0, n - 1)
    bg = np.full((n, n), -np.inf)
    np.maximum.at(bg, (ix[front], iz[front]), y[front])
    win = bg.copy()
    for dx in (-2, -1, 0, 1, 2):
        for dz in (-2, -1, 0, 1, 2):
            win = np.maximum(win, np.roll(np.roll(bg, dx, 0), dz, 1))
    h = win[ix, iz] - y
    # The ornament's outline on each axis, as (distance out along the axis, half-width across it), read from a relief
    # map of the carving: sprigs and C-scrolls by the opening, volutes, acanthus up to the rim, the point's centre leaf
    # lying over the rim, and the point beyond it.
    OUTLINE = [(0.84, 0.0), (0.86, 0.47), (1.02, 0.47), (1.05, 0.31), (1.36, 0.31), (1.39, 0.25), (1.62, 0.25),
               (1.85, 0.3), (2.2, 0.3)]
    CORE = [(1.6, 0.0), (1.62, 0.14), (1.8, 0.14), (1.82, 0.26), (2.2, 0.26)]   # the point itself: gold all over
    tc, wc = np.array([p_[0] for p_ in CORE]), np.array([p_[1] for p_ in CORE])
    ts, ws = np.array([p_[0] for p_ in OUTLINE]), np.array([p_[1] for p_ in OUTLINE])
    raised = smooth(0.03, 0.045, h)                           # the carving itself, not the surface round it
    gold = np.zeros(len(v))
    for axis in (90.0, 180.0, 270.0):
        da = np.radians((ang - axis + 180) % 360 - 180)
        along, across = r * np.cos(da), np.abs(r * np.sin(da))
        half = np.interp(along, ts, ws, left=0.0, right=0.26)
        inside = (1 - smooth(half - 0.015, half + 0.015, across)) * (along > 0.84)
        half_c = np.interp(along, tc, wc, left=0.0, right=0.26)
        core = (1 - smooth(half_c - 0.015, half_c + 0.015, across)) * (along > 1.6) * (y < W - 0.06)
        gold = np.maximum(gold, np.maximum(inside * raised, core))
    if args.gold_carving:
        # Like a gilded ceiling medallion: every carved ornament in the field gold (shells, scrolls, sprigs), the
        # smooth surfaces white (the rim mouldings, the plain band round the opening, the flat background).
        field = smooth(R_RIM * 0.61, R_RIM * 0.625, r) * (1 - smooth(R_RIM * 0.865, R_RIM * 0.88, r))  # past the shells' inner frame
        gold = np.maximum(gold, field * smooth(0.012, 0.024, h))
    gold *= front
    set_gold(ob, gold)
    print("GOLD %.1f%% of the medallion" % (100 * (gold > 0.5).mean()))


def gild_top(meshes, frac):
    """Gold on the top of a building (its dome, spire or flag): everything above frac of its height."""
    pts = np.vstack([verts(o) for o in meshes])
    z0, z1 = pts[:, 2].min(), pts[:, 2].max()
    cut = z0 + (z1 - z0) * frac
    for o in meshes:
        z = verts(o)[:, 2]
        set_gold(o, smooth(cut - 0.006, cut + 0.006, z))


if args.gold_carving:
    args.c_gold = "carving"
args.gold_carving = args.c_gold == "carving"
if not args.plain and args.c_gold != "none":
    gild_medallion(med)
# ---------------------------------------------------------------------------------------------------- skyline
D = W - Y_RIM
YF = Y_RIM                  # the buildings' fronts, level with the rim's front
Y_PLINTH = Y_RIM + 0.012    # plinths sit just behind the rim's front, so the rim stays whole in front of them
R_UNDER = R_RIM - 0.06      # plinths stop at the rim's outer edge
TURN = 15.0


def on_rim(x):
    return math.sqrt(max((R_RIM - 0.1) ** 2 - x ** 2, 0.0))


def terrace(x0, x1):
    """A trim plinth under one building's footprint x0..x1: flat on top (just above the rim's highest point under it),
    following the rim below, with a thin cornice. Returns the height the building stands at."""
    x0, x1 = x0 - 0.015, x1 + 0.015
    xs = [x1 - (x1 - x0) * i / 24 for i in range(25)]
    under_r = lambda v: math.sqrt(max(R_UNDER ** 2 - v * v, 0.0))
    z_top = max(under_r(v) for v in xs) + 0.05
    under = [(v, under_r(v)) for v in xs]
    K.prism("Plinth", [(x0, z_top - 0.02), (x1, z_top - 0.02)] + under, W, Y_PLINTH, PLASTER, bevel=0.01)
    K.box("Cornice", x1 - x0 + 0.03, 0.024, W - Y_PLINTH + 0.012, (x0 + x1) / 2, z_top - 0.024, Y_PLINTH - 0.012,
          PLASTER, bevel=0.006)
    return z_top

def group(x, z, build):
    return K.turned((x, YF + D / 2, z), TURN, build)


def place_model(path, x, width):
    """Import a building GLB, scale it to the given width, turn it like the kit's groups and stand it at (x, z)
    with its front at YF."""
    import mathutils
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
    s_ = width / (hi[0] - lo[0])
    ctr = (lo + hi) / 2
    m = mathutils.Matrix.Translation((x, YF + (ctr[1] - lo[1]) * s_, 0.0)) @ \
        mathutils.Matrix.Rotation(math.radians(TURN), 4, "Z") @ mathutils.Matrix.Scale(s_, 4) @ \
        mathutils.Matrix.Translation((-ctr[0], -ctr[1], -lo[2]))
    for o in meshes:
        o.matrix_world = m @ o.matrix_world
        o.data.materials.clear()
        o.data.materials.append(PLASTER)
        for p in o.data.polygons:
            p.use_smooth = True
    print("BUILDING", os.path.basename(path), "scale %.3f height %.3f" % (s_, (hi[2] - lo[2]) * s_))
    return meshes


GOLD_TOP = {"castle": 0.84, "tower": 0.72, "dome": 0.6}   # gold above this fraction of the height: flag, spire, dome


def stand(key, x, width, kit_build):
    """Build one building at ground level 0 (a sculpted model if one was given, else the kit's), then put a plinth
    under its turned footprint and move it up onto the plinth, pushed back so its whole base sits on it.
    Returns the height it stands at."""
    import mathutils
    before = set(bpy.data.objects)
    if key and getattr(args, key):
        place_model(getattr(args, key), x, width)
    else:
        group(x, 0.0, lambda: kit_build(x, 0.0))
    added = [o for o in bpy.data.objects if o not in before]
    new = [o for o in added if o.type == "MESH"]
    bpy.context.view_layer.update()
    pts = np.vstack([verts(o) for o in new])
    base = pts[pts[:, 2] < 0.04]                          # the footprint: the bottom few centimetres
    z = terrace(base[:, 0].min(), base[:, 0].max())
    shift = mathutils.Matrix.Translation((0, Y_PLINTH + 0.004 - base[:, 1].min(), z))
    for o in added:                                       # move the roots (the kit turns groups under an empty)
        if o.parent is None:
            o.matrix_world = shift @ o.matrix_world
    bpy.context.view_layer.update()
    if args.gold_tips and key in GOLD_TOP and getattr(args, key):
        gild_top(new, GOLD_TOP[key])
    return z


_before_sky = set(bpy.data.objects)
for key, x, width, kit in (
        ("castle", -1.2, 0.52, lambda x, z: K.castle(x, z, YF, D, 0.9)),
        ("tower", -0.85, 0.26, lambda x, z: K.campanile(x, z, YF, D, 1.0)),
        ("dome", -0.49, 0.5, lambda x, z: K.dome_church(x, z, YF, D, 0.95)),
        ("houses", -0.05, 0.44, lambda x, z: K.houses(x - 0.17, x + 0.17, z, YF, D, 0.95, rng)),
        ("factory", 0.39, 0.52, lambda x, z: K.factory(x, z, YF, D, 0.95))):
    z = stand(key, x, width, kit)
    if key == "factory":
        K.smoke(x - 0.03, z + (0.73 if args.factory else 0.8), Y_PLINTH + 0.1, 1.05)
M.gold = GOLD if args.gold_tips else PLASTER              # the kit towers' crowns and spires
for x, h in ((0.76, 1.1), (0.94, 1.35), (1.12, 0.95)):
    stand(None, x, 0.16, lambda x, z, h=h: K.deco_tower(x, z, YF, D, 1.0, h))
M.gold = PLASTER
if args.gold_city:                                          # the buildings in gold (plinths and smoke stay white)
    for ob in set(bpy.data.objects) - _before_sky:
        if ob.type == "MESH" and not ob.name.startswith(("Smoke", "Plinth", "Cornice")):
            ob.data.materials.clear()
            ob.data.materials.append(GOLD)

# ---------------------------------------------------------------------------------------------------- arc and star
sky_top = max(verts(o)[:, 2].max() for o in set(bpy.data.objects) - _before_sky if o.type == "MESH")
R_ARC = sky_top + 0.3
if args.arc:
    K.band("Orbit", lambda a: R_ARC, lambda a: R_ARC + 0.022, 32, 148, W, W - 0.05, GOLD, seg=240)
    K.star("Star", 0.0, R_ARC + 0.011, W - 0.07, 0.26, GOLD, depth=0.07)
print("SKY top %.2f, arc %.2f" % (sky_top, R_ARC))

# ---------------------------------------------------------------------------------------------------- title
if not args.plain:
    K.text("Title", "CONTINUOUS", 0.62, 0.0, -2.62, W - 0.02, 0.03, NAVY, args.font, spacing=1.06)
    K.text("Subtitle", "CIVILIZATION", 0.32, 0.0, -3.12, W - 0.02, 0.025, GOLD, args.font, spacing=1.4)
    for side in (-1, 1):
        K.box("Rule", 0.55, 0.015, 0.02, side * 1.85, -3.13, W - 0.02, GOLD, bevel=0.0)
if args.all_gold:                                           # everything but the wall and the title in gold
    for ob in list(K.COL.objects):
        if ob.type == "MESH" and ob.name != "Wall" and not ob.name.startswith("Rule"):
            ob.data.materials.clear()
            ob.data.materials.append(GOLD)

# ---------------------------------------------------------------------------------------------------- backdrop, light
WALLS = {   # (base, vein, vein width, wash): from the light cream marble to darker stones the white C stands out on
    "goldvein": None,          # white marble, grey clouds, gold veins (cc_kit.gold_vein_marble)
    "cream": None,
    "calacatta": ((0.93, 0.91, 0.88, 1), (0.36, 0.32, 0.28, 1), 0.07, (0.97, 0.95, 0.92, 1)),
    "taupe": ((0.50, 0.44, 0.37, 1), (0.86, 0.82, 0.76, 1), 0.05, (0.58, 0.51, 0.43, 1)),
    "grey": ((0.40, 0.41, 0.43, 1), (0.85, 0.86, 0.88, 1), 0.05, (0.47, 0.48, 0.50, 1)),
}
def texture_file(folder, *keys):
    """The first file in folder whose lower-cased name contains one of keys (e.g. "_color", "basecolor")."""
    for key in keys:
        hits = [f for f in os.listdir(folder) if key in f.lower() and f.lower().endswith((".jpg", ".png"))]
        if hits:
            return os.path.join(folder, hits[0])
    return None


if args.marble:
    wall_mat = K.photo_marble("Wall photo marble", texture_file(args.marble, "basecolor", "_color"),
                              texture_file(args.marble, "roughness"), texture_file(args.marble, "normalgl", "_normal"),
                              raw=args.marble_raw, offset=args.marble_place[:2], rot=args.marble_place[2],
                              size=args.marble_size, gold=args.marble_gold, levels=(0.3, 0.56), vein=(0.33, 0.32, 0.31, 1),
                              base=(0.95, 0.925, 0.87, 1))     # warm white with grey clouding
else:
    wall_mat = K.gold_vein_marble("Wall gold-veined") if args.wall == "goldvein" else M.wall if WALLS[args.wall] is None else K.marble(
    "Wall " + args.wall, WALLS[args.wall][0], WALLS[args.wall][1], 0.25, vein_width=WALLS[args.wall][2],
    wash=WALLS[args.wall][3])
if args.glow:
    # The banner's sunrise, behind the skyline only: an oval on the wall from the rim's top up past the towers.
    K.add_wall_glow(wall_mat, -0.1, R_RIM - 0.05, 2.1, sky_top - R_RIM + 0.9, 0.45, args.glow)
K.prism("Wall", [(-8, -8), (8, -8), (8, 8), (-8, 8)], 0.35, W, wall_mat)
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.92, 0.9, 0.86, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.15
K.area_light("Key", (-4.5, -5.0, 5.5), 2.5, 1800, (1.0, 0.95, 0.88))
K.area_light("Fill", (5.0, -6.5, 0.5), 7.0, 300, (0.93, 0.95, 1.0))
K.area_light("Top", (0.0, -2.5, 6.5), 5.0, 180, (1.0, 0.97, 0.92))
if args.sun:
    # A low sun from the upper left and in front: every building casts a crisp shadow down-right onto the wall, which
    # outlines the white skyline against the white marble (a sun has no hot spot, unlike a close lamp).
    import mathutils
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = args.sun
    sun.angle = math.radians(2.5)
    sun.color = (1.0, 0.95, 0.88)
    sun_ob = bpy.data.objects.new("Sun", sun)
    K.COL.objects.link(sun_ob)
    sun_dir = mathutils.Vector((0.8, 0.22, -0.5)).normalized()       # grazing the wall: long shadows
    for ob in K.COL.objects:                                            # the sun takes over from the lamps
        if ob.type == "LIGHT" and ob.name in ("Key", "Fill", "Top"):
            ob.data.energy *= 0.55
    sun_ob.rotation_euler = sun_dir.to_track_quat("-Z", "Y").to_euler()


cam_data = bpy.data.cameras.new("Camera")
cam_data.type = "ORTHO"
top, bottom = (sky_top + 0.15, -2.2) if args.plain else (R_ARC + 0.32 if args.arc else sky_top + 0.12, -3.45)
cam_data.ortho_scale = (top - bottom) * 1.06
cam = bpy.data.objects.new("Camera", cam_data)
K.COL.objects.link(cam)
cam.location = (0.0, -12.0, (top + bottom) / 2)
cam.rotation_euler = (math.radians(90), 0, 0)
scene.camera = cam
K.render(scene, args.out)
