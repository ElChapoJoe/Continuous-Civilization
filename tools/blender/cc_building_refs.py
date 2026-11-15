"""Render each skyline building from cc_kit.py alone, in white plaster on a white background, from a high
three-quarter view: reference images for an image-to-3D tool. Close Civ VII before rendering.

Run (headless):
  blender -b --factory-startup --python tools/blender/cc_building_refs.py -- --out <folder> [--size 1024] [--samples 96]
"""
import argparse
import math
import os
import random
import sys

import bpy
import mathutils

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cc_kit as K  # noqa: E402
from cc_kit import M  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--size", type=int, default=1024)
ap.add_argument("--samples", type=int, default=96)
args = ap.parse_args(argv)

# name: build(y_front, depth), at the logo's depth (the buildings are made to be seen from the front).
BUILDINGS = {
    "castle": lambda y, d: K.castle(0, 0, y, d, 1.0),
    "bell-tower": lambda y, d: K.campanile(0, 0, y, d, 1.0),
    "domed-church": lambda y, d: K.dome_church(0, 0, y, d, 1.0),
    "houses": lambda y, d: K.houses(-0.25, 0.25, 0, y, d, 1.0, random.Random(3)),
    "factory": lambda y, d: K.factory(0, 0, y, d, 1.0),
    "deco-tower": lambda y, d: K.deco_tower(0, 0, y, d, 1.0, 1.2),
    "modern-tower": lambda y, d: K.modern_tower(0, 0, y, d, 1.0, 1.4),
}
DEPTH = {"castle": 0.3, "bell-tower": 0.3, "domed-church": 0.3, "houses": 0.3, "factory": 0.3, "deco-tower": 0.3,
         "modern-tower": 0.3}

os.makedirs(args.out, exist_ok=True)
for name, build in BUILDINGS.items():
    scene = K.setup(args.size, args.size, args.samples)
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    K.init_materials()
    plaster = K.material("Plaster", (0.78, 0.77, 0.75, 1), 0.6)
    for attr in ("marble", "stone", "stone_light", "roof", "tree", "bronze", "gold", "cream", "wall"):
        setattr(M, attr, plaster)
    M.glass = K.material("Recess", (0.45, 0.44, 0.43, 1), 0.8)
    d = DEPTH[name]
    build(-d / 2, d)

    lo = mathutils.Vector((1e9,) * 3)
    hi = -lo
    for o in scene.objects:
        if o.type == "MESH":
            for c in o.bound_box:
                w = o.matrix_world @ mathutils.Vector(c)
                lo = mathutils.Vector(map(min, lo, w))
                hi = mathutils.Vector(map(max, hi, w))
    ctr = (lo + hi) / 2
    size = max(hi - lo)

    world = bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    # The camera sees a pure white background; the building is lit by a dim grey sky and the area lights only.
    nt = world.node_tree
    bg = nt.nodes["Background"]
    bg.inputs["Color"].default_value = (0.8, 0.8, 0.8, 1)
    bg.inputs["Strength"].default_value = 0.25
    white = nt.nodes.new("ShaderNodeBackground")
    white.inputs["Color"].default_value = (1, 1, 1, 1)
    white.inputs["Strength"].default_value = 1.0
    path = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(path.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(bg.outputs[0], mix.inputs[1])
    nt.links.new(white.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], nt.nodes["World Output"].inputs["Surface"])
    K.area_light("Key", (-3.0, -4.0, 4.5), 2.0, 500, (1.0, 0.97, 0.92))
    K.area_light("Fill", (4.0, -3.0, 1.0), 4.0, 120, (0.95, 0.97, 1.0))

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = size * 1.45
    cam = bpy.data.objects.new("Camera", cam_data)
    K.COL.objects.link(cam)
    az, el = math.radians(-15), math.radians(6)         # as in the logo: front-on, turned a little
    direction = mathutils.Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    cam.location = ctr + direction * 10
    cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    K.render(scene, os.path.join(args.out, name + ".png"))
