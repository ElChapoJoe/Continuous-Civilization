"""Shared Blender kit for the Continuous Civilization artwork (logo, banner): render setup, procedural materials,
mesh helpers and the miniature buildings of each era. Everything is modelled by code (no AI, no downloaded assets).

Coordinates: the artwork faces the camera; x right, z up, depth along y (toward the camera = more negative y).
Buildings are built upright, standing at (x, z) with their front face at depth y.
"""
import math
import random

import bmesh
import bpy

COL = None


# ---------------------------------------------------------------------------------------------------- scene
def setup(width, height, samples, look="AgX - Medium High Contrast", exposure=0.0):
    global COL
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = look
    scene.view_settings.exposure = exposure
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == kind
                scene.cycles.device = "GPU"
                break
        except Exception:
            continue
    COL = bpy.context.collection
    return scene


def render(scene, path):
    import os
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    scene.render.filepath = os.path.abspath(path)
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    print("rendered", path)


# ---------------------------------------------------------------------------------------------------- materials
def material(name, color, rough, metal=0.0, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = color
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat
    return mat


def marble(name, light, vein, scale, vein_width=0.05, wash=None, rot=(0.4, 0.7, 0.9)):
    mat = material(name, light, 0.3, coat=0.15)
    n, l = mat.node_tree.nodes, mat.node_tree.links
    b = n["Principled BSDF"]
    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    mp.inputs["Rotation"].default_value = rot
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    wave = n.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 0.8
    wave.inputs["Distortion"].default_value = 16.0
    wave.inputs["Detail"].default_value = 14
    wave.inputs["Detail Scale"].default_value = 0.8
    wave.inputs["Detail Roughness"].default_value = 0.62
    l.new(mp.outputs["Vector"], wave.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = vein
    ramp.color_ramp.elements[1].position = vein_width
    ramp.color_ramp.elements[1].color = light
    l.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    out = ramp.outputs["Color"]
    if wash:
        noise = n.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 0.8
        noise.inputs["Detail"].default_value = 6
        l.new(mp.outputs["Vector"], noise.inputs["Vector"])
        wr = n.new("ShaderNodeValToRGB")
        wr.color_ramp.elements[0].position = 0.45
        wr.color_ramp.elements[0].color = (1, 1, 1, 1)
        wr.color_ramp.elements[1].position = 0.8
        wr.color_ramp.elements[1].color = wash
        l.new(noise.outputs["Fac"], wr.inputs["Fac"])
        mix = n.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs["Fac"].default_value = 1.0
        l.new(out, mix.inputs["Color1"])
        l.new(wr.outputs["Color"], mix.inputs["Color2"])
        out = mix.outputs["Color"]
    l.new(out, b.inputs["Base Color"])
    return mat


def stone(name, color, scale=40.0):
    """Sandstone / limestone with a faint grain, for the buildings."""
    mat = material(name, color, 0.65)
    n, l = mat.node_tree.nodes, mat.node_tree.links
    b = n["Principled BSDF"]
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 8
    ramp = n.new("ShaderNodeValToRGB")
    c0 = tuple(v * 0.88 for v in color[:3]) + (1,)
    c1 = tuple(min(v * 1.06, 1) for v in color[:3]) + (1,)
    ramp.color_ramp.elements[0].color = c0
    ramp.color_ramp.elements[1].color = c1
    l.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    l.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return mat


def gold_vein_marble(name, scale=1.0, vein_width=0.018, seed=0.0):
    """White marble with soft grey clouding and thin gold veins (kintsugi-style cracks): a wavy grey vein pattern
    over a cloudy white base, and two Voronoi crack networks (bold and fine), bent by noise, filled with gold."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    n, l = mat.node_tree.nodes, mat.node_tree.links
    out = n["Material Output"]
    stone_ = n["Principled BSDF"]
    stone_.inputs["Roughness"].default_value = 0.2
    stone_.inputs["Coat Weight"].default_value = 0.25
    gold_ = n.new("ShaderNodeBsdfPrincipled")
    gold_.inputs["Base Color"].default_value = (1.0, 0.74, 0.36, 1)
    gold_.inputs["Metallic"].default_value = 1.0
    gold_.inputs["Roughness"].default_value = 0.3

    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    mp.inputs["Rotation"].default_value = (0.3, 0.5, 0.35)
    mp.inputs["Location"].default_value = (seed, seed * 0.7, seed * 0.3)
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    # Bend the coordinates with noise so cracks and veins wander instead of running straight.
    bend = n.new("ShaderNodeTexNoise")
    bend.inputs["Scale"].default_value = 0.9
    bend.inputs["Detail"].default_value = 5
    l.new(mp.outputs["Vector"], bend.inputs["Vector"])
    warp = n.new("ShaderNodeVectorMath")
    warp.operation = "MULTIPLY_ADD"
    warp.inputs[1].default_value = (0.45, 0.45, 0.45)
    l.new(bend.outputs["Color"], warp.inputs[0])
    l.new(mp.outputs["Vector"], warp.inputs[2])
    v = warp.outputs["Vector"]

    def ramp(fac, stops, ease=True):
        r = n.new("ShaderNodeValToRGB")
        if ease:
            r.color_ramp.interpolation = "EASE"
        (p0, c0), (p1, c1) = stops
        r.color_ramp.elements[0].position, r.color_ramp.elements[0].color = p0, c0
        r.color_ramp.elements[1].position, r.color_ramp.elements[1].color = p1, c1
        l.new(fac, r.inputs["Fac"])
        return r.outputs["Color"]

    # Grey veins: soft, smoky bands; and a faint cloudy wash.
    wave = n.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 0.4
    wave.inputs["Distortion"].default_value = 12.0
    wave.inputs["Detail"].default_value = 12
    wave.inputs["Detail Roughness"].default_value = 0.65
    l.new(v, wave.inputs["Vector"])
    grey = ramp(wave.outputs["Fac"], ((0.0, (0.66, 0.67, 0.69, 1)), (0.11, (0.95, 0.95, 0.95, 1))))
    cloud = n.new("ShaderNodeTexNoise")
    cloud.inputs["Scale"].default_value = 1.6
    cloud.inputs["Detail"].default_value = 8
    l.new(v, cloud.inputs["Vector"])
    wash = ramp(cloud.outputs["Fac"], ((0.45, (1, 1, 1, 1)), (0.8, (0.87, 0.88, 0.9, 1))))
    mul = n.new("ShaderNodeMixRGB")
    mul.blend_type = "MULTIPLY"
    mul.inputs["Fac"].default_value = 1.0
    l.new(grey, mul.inputs["Color1"])
    l.new(wash, mul.inputs["Color2"])
    l.new(mul.outputs["Color"], stone_.inputs["Base Color"])

    # Gold cracks: the edges of two Voronoi networks, the fine one only in patches.
    def cracks(sc, width):
        vor = n.new("ShaderNodeTexVoronoi")
        vor.feature = "DISTANCE_TO_EDGE"
        vor.inputs["Scale"].default_value = sc
        vor.inputs["Randomness"].default_value = 1.0
        l.new(v, vor.inputs["Vector"])
        return ramp(vor.outputs["Distance"], ((0.0, (1, 1, 1, 1)), (width, (0, 0, 0, 1))))

    bold = cracks(0.36, vein_width)
    fine = cracks(1.1, vein_width * 0.6)
    patch = n.new("ShaderNodeTexNoise")
    patch.inputs["Scale"].default_value = 1.1
    l.new(mp.outputs["Vector"], patch.inputs["Vector"])
    patch_m = ramp(patch.outputs["Fac"], ((0.56, (0, 0, 0, 1)), (0.64, (1, 1, 1, 1))))
    fine_m = n.new("ShaderNodeMixRGB")
    fine_m.blend_type = "MULTIPLY"
    fine_m.inputs["Fac"].default_value = 1.0
    l.new(fine, fine_m.inputs["Color1"])
    l.new(patch_m, fine_m.inputs["Color2"])
    both = n.new("ShaderNodeMixRGB")
    both.blend_type = "LIGHTEN"
    both.inputs["Fac"].default_value = 1.0
    l.new(bold, both.inputs["Color1"])
    l.new(fine_m.outputs["Color"], both.inputs["Color2"])
    mix = n.new("ShaderNodeMixShader")
    l.new(both.outputs["Color"], mix.inputs[0])
    l.new(stone_.outputs[0], mix.inputs[1])
    l.new(gold_.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs["Surface"])
    return mat


def photo_marble(name, color_path, rough_path=None, normal_path=None, size=7.0, gold=True, levels=(0.26, 0.6),
                 vein=(0.42, 0.42, 0.43, 1), base=(0.95, 0.945, 0.93, 1), raw=False, offset=(0.37, 0.21), rot=0.0,
                 gold_patch=(0.5, 0.56)):
    """A wall of real marble from a photo-scanned texture (e.g. a CC0 ambientCG set, kept outside the repo), laid on
    the x/z plane: brightened and neutralised to white with grey veins (levels: the texture's vein and base
    brightness), and, with gold=True, thin gold veins running through it (kintsugi-style)."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    n, l = mat.node_tree.nodes, mat.node_tree.links
    out = n["Material Output"]
    stone_ = n["Principled BSDF"]
    stone_.inputs["Coat Weight"].default_value = 0.2

    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Object"], sep.inputs[0])
    comb = n.new("ShaderNodeCombineXYZ")
    l.new(sep.outputs["X"], comb.inputs["X"])
    l.new(sep.outputs["Z"], comb.inputs["Y"])
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / size, 1 / size, 1)
    mp.inputs["Location"].default_value = (offset[0], offset[1], 0)
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(rot))
    l.new(comb.outputs["Vector"], mp.inputs["Vector"])
    uv = mp.outputs["Vector"]

    def image(path, colour=True):
        t = n.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(path)
        if not colour:
            t.image.colorspace_settings.name = "Non-Color"
        l.new(uv, t.inputs["Vector"])
        return t

    def ramp(fac, stops):
        r = n.new("ShaderNodeValToRGB")
        r.color_ramp.interpolation = "EASE"
        (p0, c0), (p1, c1) = stops
        r.color_ramp.elements[0].position, r.color_ramp.elements[0].color = p0, c0
        r.color_ramp.elements[1].position, r.color_ramp.elements[1].color = p1, c1
        l.new(fac, r.inputs["Fac"])
        return r.outputs["Color"]

    col = image(color_path)
    bw = n.new("ShaderNodeRGBToBW")
    l.new(col.outputs["Color"], bw.inputs[0])
    lum = bw.outputs[0]
    if raw:                                   # use the photo's own colours
        l.new(col.outputs["Color"], stone_.inputs["Base Color"])
    else:
        l.new(ramp(lum, ((levels[0], vein), (levels[1], base))), stone_.inputs["Base Color"])
    if rough_path:
        rough = image(rough_path, colour=False)
        rr = n.new("ShaderNodeMapRange")
        rr.inputs["To Min"].default_value = 0.12
        rr.inputs["To Max"].default_value = 0.4
        l.new(rough.outputs["Color"], rr.inputs["Value"])
        l.new(rr.outputs["Result"], stone_.inputs["Roughness"])
    if normal_path:
        nt_ = image(normal_path, colour=False)
        nm = n.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = 0.3
        l.new(nt_.outputs["Color"], nm.inputs["Color"])
        l.new(nm.outputs["Normal"], stone_.inputs["Normal"])
    if not gold:
        return mat

    gold_ = n.new("ShaderNodeBsdfPrincipled")
    gold_.inputs["Base Color"].default_value = (1.0, 0.78, 0.4, 1)
    gold_.inputs["Metallic"].default_value = 1.0
    gold_.inputs["Roughness"].default_value = 0.25
    # Gold veins as clean continuous lines: the edges of two Voronoi networks (bold, and fine in patches), bent by
    # noise so they wander like cracks through the stone.
    bend = n.new("ShaderNodeTexNoise")
    bend.inputs["Scale"].default_value = size * 0.9
    bend.inputs["Detail"].default_value = 5
    l.new(uv, bend.inputs["Vector"])
    warp = n.new("ShaderNodeVectorMath")
    warp.operation = "MULTIPLY_ADD"
    warp.inputs[1].default_value = (0.45 / size, 0.45 / size, 0.0)
    l.new(bend.outputs["Color"], warp.inputs[0])
    l.new(uv, warp.inputs[2])

    def cracks(sc, width):
        vor = n.new("ShaderNodeTexVoronoi")
        vor.feature = "DISTANCE_TO_EDGE"
        vor.inputs["Scale"].default_value = sc * size
        l.new(warp.outputs["Vector"], vor.inputs["Vector"])
        return ramp(vor.outputs["Distance"], ((0.0, (1, 1, 1, 1)), (width, (0, 0, 0, 1))))

    bold = cracks(0.36, 0.02)
    fine = cracks(1.1, 0.012)
    patch = n.new("ShaderNodeTexNoise")
    patch.inputs["Scale"].default_value = size * 1.1
    l.new(uv, patch.inputs["Vector"])
    where = ramp(patch.outputs["Fac"], ((gold_patch[0] + 0.06, (0, 0, 0, 1)), (gold_patch[1] + 0.08, (1, 1, 1, 1))))
    fine_m = n.new("ShaderNodeMixRGB")
    fine_m.blend_type = "MULTIPLY"
    fine_m.inputs["Fac"].default_value = 1.0
    l.new(fine, fine_m.inputs["Color1"])
    l.new(where, fine_m.inputs["Color2"])
    mask = n.new("ShaderNodeMixRGB")
    mask.blend_type = "LIGHTEN"
    mask.inputs["Fac"].default_value = 1.0
    l.new(bold, mask.inputs["Color1"])
    l.new(fine_m.outputs["Color"], mask.inputs["Color2"])
    mix = n.new("ShaderNodeMixShader")
    l.new(mask.outputs["Color"], mix.inputs[0])
    l.new(stone_.outputs[0], mix.inputs[1])
    l.new(gold_.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs["Surface"])
    return mat


def add_wall_glow(mat, cx, cz, rx, rz_up, rz_down, strength, power=1.4, colour=(1.0, 0.42, 0.1, 1)):
    """Make a wall material glow like a sunrise behind something: an orange oval centred on (cx, cz) in the wall's
    x/z plane, rz_up tall above cz and rz_down below it, brightest at its centre line and fading smoothly to nothing at
    its edge. Added on top of the wall's own shading (as emission, so it also lights what stands in front of it)."""
    nt = mat.node_tree
    n, l = nt.nodes, nt.links
    out = n["Material Output"]
    surface = out.inputs["Surface"].links[0].from_socket
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Object"], sep.inputs[0])

    def m_(op, a, b=None):
        node = n.new("ShaderNodeMath")
        node.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                node.inputs[i].default_value = v
            else:
                l.new(v, node.inputs[i])
        return node.outputs[0]

    dz = m_("SUBTRACT", sep.outputs["Z"], cz)
    above = m_("GREATER_THAN", dz, 0.0)
    rz = m_("ADD", m_("MULTIPLY", above, rz_up - rz_down), rz_down)
    u = m_("DIVIDE", m_("SUBTRACT", sep.outputs["X"], cx), rx)
    v = m_("DIVIDE", dz, rz)
    d = m_("SQRT", m_("ADD", m_("MULTIPLY", u, u), m_("MULTIPLY", v, v)))
    f = m_("POWER", m_("MAXIMUM", m_("SUBTRACT", 1.0, d), 0.0), power)
    em = n.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = colour
    l.new(m_("MULTIPLY", f, strength), em.inputs["Strength"])
    add = n.new("ShaderNodeAddShader")
    l.new(surface, add.inputs[0])
    l.new(em.outputs[0], add.inputs[1])
    l.new(add.outputs[0], out.inputs["Surface"])


class M:
    """The shared palette (call init() after setup())."""


def init_materials():
    M.marble = marble("Marble", (0.93, 0.90, 0.85, 1), (0.70, 0.64, 0.56, 1), 1.3, vein_width=0.04)
    M.wall = marble("Wall", (0.92, 0.88, 0.82, 1), (0.80, 0.70, 0.56, 1), 0.25, vein_width=0.03, wash=(0.96, 0.90, 0.80, 1))
    M.stone = stone("Sandstone", (0.34, 0.26, 0.17, 1))
    M.stone_light = stone("Limestone", (0.43, 0.35, 0.24, 1))
    M.roof = stone("Roof tile", (0.50, 0.30, 0.18, 1), scale=60)
    M.gold = material("Gold", (1.0, 0.72, 0.32, 1), 0.2, metal=1.0)
    M.bronze = material("Dome bronze", (0.86, 0.52, 0.24, 1), 0.3, metal=0.85)
    M.navy = material("Navy", (0.006, 0.014, 0.05, 1), 0.38, coat=0.35)
    M.cream = material("Cream", (0.80, 0.73, 0.60, 1), 0.45)
    M.tree = material("Cypress", (0.12, 0.17, 0.08, 1), 0.7)
    M.glass = material("Glass", (0.16, 0.18, 0.22, 1), 0.25, metal=0.4)
    M.smoke = material("Smoke", (0.92, 0.90, 0.88, 1), 0.9)
    return M


# ---------------------------------------------------------------------------------------------------- meshes
def finish(name, bm, mat, bevel=0.0, smooth=False, segments=2):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    COL.objects.link(ob)
    ob.data.materials.append(mat)
    if bevel:
        m = ob.modifiers.new("Bevel", "BEVEL")
        m.width = bevel
        m.segments = segments
        m.limit_method = "ANGLE"
    return ob


def prism(name, outline, y0, y1, mat, bevel=0.0):
    """Extrude a closed outline [(x, z), ...] from y0 (back) to y1 (front)."""
    bm = bmesh.new()
    back = [bm.verts.new((x, y0, z)) for x, z in outline]
    front = [bm.verts.new((x, y1, z)) for x, z in outline]
    bm.faces.new(back)
    bm.faces.new(list(reversed(front)))
    k = len(outline)
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new((back[i], back[j], front[j], front[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, mat, bevel)


def band(name, r_in, r_out, a0, a1, y0, y1, mat, bevel=0.0, seg=240, r_out_back=None):
    """A curved band between radius functions r_in(a) < r_out(a) (a in degrees), from angle a0 to a1. r_out_back, if
    given, is the outer radius at the back (y0): a wider back gives the band a sloped, visible side."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        r0, r1 = r_in(a), r_out(a)
        rb = r_out_back(a) if r_out_back else r1
        rings.append([bm.verts.new((r * c, y, r * s)) for r, y in ((r0, y0), (rb, y0), (r1, y1), (r0, y1))])
    for i in range(seg):
        a, b = rings[i], rings[i + 1]
        for k in range(4):
            bm.faces.new((a[k], b[k], b[(k + 1) % 4], a[(k + 1) % 4]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, mat, bevel, smooth=True)


def box(name, w, h, d, x, z, y, mat, bevel=0.006):
    """Box of width w, height h, depth d, bottom-centre at (x, z), front face at y."""
    return prism(name, [(x - w / 2, z), (x + w / 2, z), (x + w / 2, z + h), (x - w / 2, z + h)], y + d, y, mat, bevel)


def cyl(name, r, h, x, z, y, mat, seg=32, r_top=None, bevel=0.0):
    """Upright cylinder / frustum / cone standing at (x, z), axis at depth y."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r_top is None else r_top, depth=h)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(x, y, z + h / 2))
    return finish(name, bm, mat, bevel, smooth=True)


def ycyl(name, r, d, x, z, y, mat, seg=32):
    """Cylinder lying along y (toward the camera), front face at y: wheels, gears, arch cutters."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=d)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__("mathutils").Matrix.Rotation(math.radians(90), 3, "X"))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(x, y + d / 2, z))
    return finish(name, bm, mat, smooth=True)


def ellipsoid(name, rx, ry, rz, x, z, y, mat, half=False):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=1.0)
    if half:
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context="VERTS")
    bmesh.ops.scale(bm, vec=(rx, ry, rz), verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(x, y, z))
    return finish(name, bm, mat, smooth=True)


def gable(w, h, d, x, z, y, mat):
    return prism("Roof", [(x - w / 2, z), (x + w / 2, z), (x, z + h)], y + d, y, mat, bevel=0.003)


def cut_arches(ob, xs, r, z_spring, y, d):
    """Cut round-headed arches (a cylinder over a box) through a block, with booleans."""
    for x in xs:
        for cutter in (ycyl("Arch cutter", r, d + 0.2, x, z_spring, y - 0.1, M.stone, seg=24),
                       box("Arch cutter", r * 2, 10.0, d + 0.2, x, z_spring - 10.0, y - 0.1, M.stone, bevel=0)):
            mod = ob.modifiers.new("Arch", "BOOLEAN")
            mod.operation = "DIFFERENCE"
            mod.object = cutter
            cutter.hide_render = True
            cutter.display_type = "WIRE"
    return ob


def text(name, body, size, x, z, y, depth, mat, font, spacing=1.0, yaw=0.0):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.font = bpy.data.fonts.load(font)
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.extrude = depth
    cu.bevel_depth = depth * 0.3
    cu.bevel_resolution = 3
    cu.space_character = spacing
    ob = bpy.data.objects.new(name, cu)
    COL.objects.link(ob)
    ob.rotation_euler = (math.radians(90), 0, yaw)   # yaw turns the text to face an angled camera
    ob.location = (x, y, z)
    ob.data.materials.append(mat)
    return ob


def star(name, x, z, y, r_long, mat, depth=0.06):
    pts = []
    for i in range(16):
        r = r_long if i % 4 == 0 else (r_long * 0.5 if i % 4 == 2 else r_long * 0.2)
        a = math.radians(90 + i * 22.5)
        pts.append((x + r * math.cos(a), z + r * math.sin(a)))
    return prism(name, pts, y + depth, y, mat, bevel=0.006)


def area_light(name, loc, size, energy, color, target=(0, 0, 0)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.size = size
    ld.energy = energy
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    COL.objects.link(ob)
    ob.location = loc
    tgt = bpy.data.objects.new(name + " target", None)
    COL.objects.link(tgt)
    tgt.location = target
    c = ob.constraints.new("TRACK_TO")
    c.target = tgt
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    return ob


# ---------------------------------------------------------------------------------------------------- buildings
# Each builder stands a building at (x, z) (bottom centre) with its front at depth y and depth d, scaled by s.
def cypress(x, z, y, s):
    cyl("Trunk", 0.008 * s, 0.03 * s, x, z, y, M.stone, seg=8)
    ellipsoid("Cypress", 0.035 * s, 0.035 * s, 0.13 * s, x, z + 0.14 * s, y, M.tree)


def castle(x, z, y, d, s):
    box("Curtain wall", 0.42 * s, 0.2 * s, d, x, z, y, M.stone)
    for k in range(6):
        box("Merlon", 0.035 * s, 0.035 * s, d, x - 0.17 * s + k * 0.068 * s, z + 0.2 * s, y, M.stone, bevel=0.003)
    for dx, h, w in ((-0.2, 0.42, 0.13), (0.2, 0.34, 0.12), (0.02, 0.5, 0.11)):
        tx = x + dx * s
        box("Keep", w * s, h * s, d * 0.9, tx, z, y - 0.01, M.stone)
        for k in range(3):
            box("Merlon", w * s / 4.5, 0.035 * s, d * 0.9, tx - w * s / 3 + k * w * s / 3, z + h * s, y - 0.01, M.stone, bevel=0.003)
        for k in range(2):
            box("Slit", 0.012 * s, 0.05 * s, 0.005, tx, z + (0.12 + k * 0.14) * s, y - 0.015, M.glass, bevel=0)
    cyl("Flagpole", 0.004 * s, 0.14 * s, x + 0.02 * s, z + 0.535 * s, y + d / 2, M.gold, seg=8)
    prism("Flag", [(x + 0.024 * s, z + 0.62 * s), (x + 0.11 * s, z + 0.6 * s), (x + 0.024 * s, z + 0.565 * s)],
          y + d / 2 + 0.006, y + d / 2 - 0.006, M.gold)


def arcade(x0, x1, z, y, d, h, n, mat=None):
    mat = mat or M.stone_light
    blk = box("Arcade", x1 - x0, h, d, (x0 + x1) / 2, z, y, mat, bevel=0.004)
    pitch = (x1 - x0) / n
    r = pitch * 0.32
    xs = [x0 + pitch * (i + 0.5) for i in range(n)]
    cut_arches(blk, xs, r, z + h * 0.62, y, d)
    box("Cornice", x1 - x0 + 0.02, 0.025, d + 0.01, (x0 + x1) / 2, z + h, y - 0.005, mat, bevel=0.003)


def houses(x0, x1, z, y, d, s, rng):
    x = x0
    while x < x1:
        w = rng.uniform(0.06, 0.09) * s
        h = rng.uniform(0.07, 0.12) * s
        box("House", w, h, d * 0.8, x + w / 2, z, y + d * 0.1, M.stone_light)
        gable(w * 1.12, h * 0.55, d * 0.85, x + w / 2, z + h, y + d * 0.075, M.roof)
        box("Window", w * 0.25, h * 0.25, 0.004, x + w / 2, z + h * 0.4, y + d * 0.1 - 0.003, M.glass, bevel=0)
        x += w + 0.008 * s


def campanile(x, z, y, d, s):
    box("Campanile", 0.1 * s, 0.6 * s, d * 0.6, x, z, y + d * 0.2, M.stone_light)
    box("Belfry", 0.12 * s, 0.1 * s, d * 0.65, x, z + 0.6 * s, y + d * 0.18, M.stone_light)
    box("Bell opening", 0.05 * s, 0.06 * s, 0.004, x, z + 0.62 * s, y + d * 0.18 - 0.003, M.glass, bevel=0)
    cyl("Spire", 0.085 * s, 0.16 * s, x, z + 0.7 * s, y + d / 2, M.roof, seg=4, r_top=0.0)


def dome_church(x, z, y, d, s):
    box("Church", 0.5 * s, 0.24 * s, d, x, z, y, M.stone_light)
    gable(0.52 * s, 0.08 * s, d, x, z + 0.24 * s, y, M.roof)
    for k in range(5):
        box("Window", 0.025 * s, 0.07 * s, 0.004, x - 0.16 * s + k * 0.08 * s, z + 0.09 * s, y - 0.003, M.glass, bevel=0)
    cyl("Drum", 0.15 * s, 0.13 * s, x, z + 0.24 * s, y + d / 2, M.stone_light, seg=48)
    for k in range(8):
        a = math.radians(k * 22.5 - 78)
        box("Drum window", 0.018 * s, 0.05 * s, 0.004, x + 0.14 * s * math.sin(a), z + 0.28 * s, y + d / 2 - 0.15 * s * math.cos(a) * 0.95, M.glass, bevel=0)
    ellipsoid("Dome", 0.16 * s, 0.16 * s, 0.2 * s, x, z + 0.37 * s, y + d / 2, M.bronze, half=True)
    cyl("Lantern", 0.03 * s, 0.07 * s, x, z + 0.565 * s, y + d / 2, M.stone_light, seg=16)
    cyl("Lantern cap", 0.032 * s, 0.05 * s, x, z + 0.635 * s, y + d / 2, M.gold, seg=16, r_top=0.0)
    cyl("Cross", 0.004 * s, 0.05 * s, x, z + 0.68 * s, y + d / 2, M.gold, seg=8)


def gear(x, z, y, r, mat=None):
    mat = mat or M.gold
    ycyl("Gear", r, 0.03, x, z, y, mat, seg=48)
    ycyl("Hub", r * 0.3, 0.045, x, z, y - 0.008, mat, seg=24)
    for k in range(12):
        a = 2 * math.pi * k / 12
        t = box("Tooth", r * 0.22, r * 0.25, 0.03, 0, 0, 0, mat, bevel=0.002)
        t.location = (x + r * 0.9 * math.cos(a), y, z + r * 0.9 * math.sin(a))
        t.rotation_euler = (0, -a + math.pi / 2, 0)


def factory(x, z, y, d, s, chimneys=3):
    w = 0.5 * s
    box("Factory", w, 0.2 * s, d, x, z, y, M.stone)
    for k in range(4):
        x0 = x - w / 2 + k * w / 4
        prism("Sawtooth", [(x0, z + 0.2 * s), (x0 + w / 4, z + 0.2 * s), (x0 + w / 4, z + 0.27 * s)], y + d, y, M.roof, bevel=0.002)
        box("Window", w / 4 * 0.6, 0.06 * s, 0.004, x0 + w / 8, z + 0.07 * s, y - 0.003, M.glass, bevel=0)
    for k in range(chimneys):
        cx = x - 0.16 * s + k * 0.13 * s
        h = (0.55 + 0.1 * (k % 2)) * s
        cyl("Chimney", 0.03 * s, h, cx, z + 0.15 * s, y + d * 0.6, M.stone, seg=24, r_top=0.024 * s)
        cyl("Chimney band", 0.034 * s, 0.025 * s, cx, z + 0.15 * s + h - 0.06 * s, y + d * 0.6, M.roof, seg=24)


def smoke(x, z, y, s):
    for k, (dx, dz, r) in enumerate(((0.0, 0.0, 0.035), (0.04, 0.05, 0.045), (0.1, 0.09, 0.05))):
        ellipsoid("Smoke", r * s * 1.3, r * s, r * s, x + dx * s, z + dz * s, y, M.smoke)


def deco_tower(x, z, y, d, s, h):
    """Art Deco skyscraper: setbacks, vertical window stripes, a gold crown and spire."""
    tiers = ((0.16, h * 0.62), (0.12, h * 0.22), (0.08, h * 0.12))
    z0 = z
    for w, th in tiers:
        box("Tier", w * s, th * s, d * 0.8, x, z0, y + d * 0.1, M.stone_light)
        for k in range(int(w * 40)):
            box("Stripe", 0.006 * s, th * s * 0.85, 0.004, x - w * s / 2 + (k + 0.5) * w * s / int(w * 40), z0 + th * s * 0.07, y + d * 0.1 - 0.003, M.glass, bevel=0)
        z0 += th * s
    cyl("Crown", 0.04 * s, 0.1 * s, x, z0, y + d / 2, M.gold, seg=24, r_top=0.012 * s)
    cyl("Spire", 0.008 * s, 0.14 * s, x, z0 + 0.1 * s, y + d / 2, M.gold, seg=8, r_top=0.001)


def modern_tower(x, z, y, d, s, h, w=0.13):
    box("Tower", w * s, h * s, d * 0.8, x, z, y + d * 0.1, M.stone_light)
    for k in range(int(h / 0.04)):
        box("Window band", w * s * 0.8, 0.012 * s, 0.004, x, z + (0.025 + k * 0.04) * s, y + d * 0.1 - 0.003, M.glass, bevel=0)
    box("Roof", w * s * 0.6, 0.04 * s, d * 0.6, x, z + h * s, y + d * 0.2, M.stone_light)


def turned(pivot, yaw_deg, build):
    """Run build() and turn everything it created by yaw_deg around a vertical axis through pivot (x, y, z), so a
    building group shows its side to a front-on camera."""
    before = set(bpy.data.objects)
    build()
    new = [o for o in bpy.data.objects if o not in before and o.parent is None]
    e = bpy.data.objects.new("Turn", None)
    COL.objects.link(e)
    e.location = pivot
    bpy.context.view_layer.update()
    inv = e.matrix_world.inverted()
    for o in new:
        o.parent = e
        o.matrix_parent_inverse = inv
    e.rotation_euler = (0, 0, math.radians(yaw_deg))
    return e


def lathe(name, profile, a0, a1, mat, seg=360, smooth_angle=40.0):
    """Sweep a moulding profile around the C's axis (y) from angle a0 to a1 (degrees). profile(a) returns the same
    number of (r, y) points for every angle (outer wall foot first, inner wall foot last), so the profile can change
    along the arc. The ends are closed with flat caps."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        rings.append([bm.verts.new((r * c, y, r * s)) for r, y in profile(a)])
    n = len(rings[0])
    for i in range(seg):
        for j in range(n - 1):
            bm.faces.new((rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j]))
    for ring in (rings[0], rings[-1]):
        try:
            f = bm.faces.new(ring)
            bmesh.ops.triangulate(bm, faces=[f])
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = finish(name, bm, mat, smooth=True)
    m = ob.modifiers.new("Crease", "EDGE_SPLIT")
    m.split_angle = math.radians(smooth_angle)
    return ob


def ring_bead(name, r, y, radius, a0, a1, mat, seg=360):
    """A round bead (half-sunk torus) of the given cross-section radius along radius r at depth y."""
    prof = [(r + radius * math.cos(t), y - radius * math.sin(t)) for t in [math.pi * k / 10 for k in range(11)]]
    return lathe(name, lambda a: prof, a0, a1, mat, seg=seg, smooth_angle=80.0)


def tube(name, pts, y, thick, mat, radii=None, flatten=0.6):
    """A round, capped tube along points [(x, z), ...] at depth y, its radius scaled per point (radii), flattened
    toward the wall so it reads as carved relief."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = thick
    cu.bevel_resolution = 4
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for i, (x, z) in enumerate(pts):
        sp.points[i].co = (x, 0.0, z, 1.0)
        sp.points[i].radius = radii[i] if radii else 1.0
    ob = bpy.data.objects.new(name, cu)
    COL.objects.link(ob)
    ob.location = (0, y, 0)
    ob.scale = (1, flatten, 1)
    ob.data.materials.append(mat)
    return ob


def spiral(name, cx, cz, y, r_out, r_in, turns, thick, mat, start_deg=0.0, clockwise=False, n=90, flatten=0.6):
    """A carved scroll / volute: a tube winding from radius r_out inward to r_in around (cx, cz), thinning as it
    goes."""
    pts, radii = [], []
    for i in range(n + 1):
        t = i / n
        a = math.radians(start_deg) + (-1 if clockwise else 1) * 2 * math.pi * turns * t
        r = r_out + (r_in - r_out) * t
        pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
        radii.append(1.0 - 0.55 * t)
    return tube(name, pts, y, thick, mat, radii, flatten)


def rib(name, bx, bz, y, angle_deg, length, width, mat, depth=None):
    """A carved rib (a long half-buried ellipsoid) starting at (bx, bz) and pointing at angle_deg (0 = +x)."""
    ob = ellipsoid(name, width, depth or width * 0.8, length / 2, 0, 0, 0, mat)
    ob.data.transform(__import__("mathutils").Matrix.Translation((0, 0, length / 2)))
    ob.location = (bx, y, bz)
    ob.rotation_euler = (0, math.radians(90 - angle_deg), 0)
    return ob
