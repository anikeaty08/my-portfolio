"""Procedurally models the portfolio's 3D assets and exports them as GLB.

Run headless:  blender --background --factory-startup --python scripts/blender/build_models.py -- <out_dir>
"""

import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector, noise

OUT_DIR = Path(sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "public/models")
OUT_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------- helpers

_materials = {}


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials):
        for item in list(block):
            block.remove(item)
    _materials.clear()


def mat(name, color, metallic=0.0, roughness=0.5, emission=None, strength=0.0):
    key = (name, color, metallic, roughness, emission, strength)
    if key in _materials:
        return _materials[key]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    _materials[key] = m
    return m


def hex_rgb(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def finish(obj, material, parent, smooth=True, bevel=0.0):
    obj.data.materials.clear()
    obj.data.materials.append(material)
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    if smooth:
        bpy.ops.object.shade_smooth()
    else:
        bpy.ops.object.shade_flat()
    obj.parent = parent
    return obj


def cube(size, loc, material, parent, rot=(0, 0, 0), bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, material, parent, smooth=False, bevel=bevel)


def sphere(radius, loc, material, parent, scale=(1, 1, 1), segments=32):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=segments, ring_count=segments // 2)
    o = bpy.context.active_object
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, material, parent)


def cylinder(radius, depth, loc, material, parent, rot=(0, 0, 0), verts=32, bevel=0.01):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.active_object
    return finish(o, material, parent, smooth=True, bevel=bevel)


def cone(r1, r2, depth, loc, material, parent, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot, vertices=32)
    return finish(bpy.context.active_object, material, parent)


def torus(major, minor, loc, material, parent, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot,
                                     major_segments=64, minor_segments=16)
    return finish(bpy.context.active_object, material, parent)


def root(name):
    bpy.ops.object.empty_add(location=(0, 0, 0))
    e = bpy.context.active_object
    e.name = name
    return e


def export(name):
    for o in bpy.context.scene.objects:
        if o.type == "MESH":
            bpy.context.view_layer.objects.active = o
            for m in list(o.modifiers):
                bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.select_all(action="SELECT")
    path = OUT_DIR / f"{name}.glb"
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True, export_yup=True)
    print(f"[models] wrote {path} ({path.stat().st_size // 1024} KB)")


# Blender is Z-up; the exporter converts to Y-up. Models are authored facing -Y (toward the viewer).

# ---------------------------------------------------------------- PolyChat: encrypted chat bubbles

def build_polychat():
    reset_scene()
    r = root("polychat")
    violet = mat("violet", hex_rgb("#7c3aed"), 0.1, 0.25, hex_rgb("#8b5cf6"), 0.6)
    cyan = mat("cyan", hex_rgb("#06b6d4"), 0.1, 0.25, hex_rgb("#22d3ee"), 0.6)
    white = mat("white", (1, 1, 1), 0, 0.3, (1, 1, 1), 3.0)
    gold = mat("gold", hex_rgb("#f5b83d"), 1.0, 0.22)

    sphere(1, (-0.35, 0, 0.35), violet, r, scale=(1.05, 0.34, 0.72))
    cone(0.22, 0, 0.5, (-0.95, 0, -0.2), violet, r, rot=(0, math.radians(-140), 0))
    for i in range(3):
        sphere(0.1, (-0.7 + i * 0.35, -0.36, 0.35), white, r, segments=16)

    sphere(0.75, (0.55, 0.25, -0.45), cyan, r, scale=(1.0, 0.42, 0.7))
    cone(0.16, 0, 0.4, (1.05, 0.25, -0.85), cyan, r, rot=(0, math.radians(140), 0))

    cube((0.42, 0.18, 0.34), (0.75, -0.25, 0.75), gold, r, bevel=0.04)
    torus(0.14, 0.035, (0.75, -0.25, 0.96), gold, r, rot=(math.radians(90), 0, 0))
    export("polychat")


# ---------------------------------------------------------------- raGG: floating knowledge library

def build_ragg():
    reset_scene()
    r = root("ragg")
    random.seed(7)
    covers = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#a855f7", "#ec4899"]
    paper = mat("paper", hex_rgb("#f3eee2"), 0, 0.8)
    z = -0.9
    for i, c in enumerate(covers):
        rz = random.uniform(-0.35, 0.35)
        w, d = random.uniform(1.1, 1.4), random.uniform(0.8, 0.95)
        cube((w, d, 0.2), (random.uniform(-0.08, 0.08), 0, z), mat(f"cover{i}", hex_rgb(c), 0.1, 0.45), r,
             rot=(0, 0, rz), bevel=0.025)
        cube((w - 0.08, d - 0.02, 0.15), (random.uniform(-0.08, 0.08) + 0.04, 0, z), paper, r, rot=(0, 0, rz), bevel=0)
        z += 0.22
    glow = mat("glow", hex_rgb("#38bdf8"), 0, 0.2, hex_rgb("#38bdf8"), 4.0)
    torus(1.25, 0.018, (0, 0, 0.1), glow, r, rot=(math.radians(72), math.radians(12), 0))
    for i in range(4):
        a = i / 4 * math.tau
        cube((0.36, 0.02, 0.46), (math.cos(a) * 1.25, math.sin(a) * 0.4, 0.1 + math.sin(a) * 1.15), paper, r,
             rot=(math.radians(72), 0, a), bevel=0.005)
    export("ragg")


# ---------------------------------------------------------------- EquiClear: ZK crystal + gavel

def build_equiclear():
    reset_scene()
    r = root("equiclear")
    crystal = mat("crystal", hex_rgb("#2dd4bf"), 0.0, 0.05, hex_rgb("#14b8a6"), 1.4)
    wood = mat("wood", hex_rgb("#7c4a24"), 0, 0.55)
    brass = mat("brass", hex_rgb("#d4a64a"), 1, 0.25)

    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.62, location=(0, 0, 0.35))
    c = bpy.context.active_object
    c.scale = (0.75, 0.75, 1.5)
    bpy.ops.object.transform_apply(scale=True)
    finish(c, crystal, r, smooth=False)

    cylinder(0.75, 0.16, (0, 0, -0.95), wood, r)
    cylinder(0.62, 0.05, (0, 0, -0.85), brass, r)

    side = (0, math.radians(90), 0)
    cylinder(0.2, 0.75, (0.95, 0, -0.5), wood, r, rot=side, bevel=0.02)
    cylinder(0.21, 0.07, (0.62, 0, -0.5), brass, r, rot=side)
    cylinder(0.21, 0.07, (1.28, 0, -0.5), brass, r, rot=side)
    lean = math.radians(28)
    cylinder(0.05, 1.3, (0.95 + 0.65 * math.sin(lean), 0, -0.5 + 0.65 * math.cos(lean)), wood, r, rot=(0, lean, 0))
    export("equiclear")


# ---------------------------------------------------------------- PoolGuard: shield + liquidity drop

def build_poolguard():
    reset_scene()
    r = root("poolguard")
    steel = mat("steel", hex_rgb("#cbd5e1"), 1.0, 0.18)
    green = mat("emerald", hex_rgb("#065f46"), 0.2, 0.3, hex_rgb("#10b981"), 0.8)
    water = mat("water", hex_rgb("#38bdf8"), 0.0, 0.05, hex_rgb("#0ea5e9"), 2.5)

    outline = [(-0.8, 0.95), (0, 0.8), (0.8, 0.95), (0.82, 0.3), (0.68, -0.35), (0.38, -0.8), (0, -1.08),
               (-0.38, -0.8), (-0.68, -0.35), (-0.82, 0.3)]

    def shield(name, scale, depth, y, material):
        me = bpy.data.meshes.new(name)
        bm = bmesh.new()
        verts = [bm.verts.new((x * scale, 0, zz * scale)) for x, zz in outline]
        bm.faces.new(verts)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(o)
        o.location.y = y
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        sol = o.modifiers.new("solidify", "SOLIDIFY")
        sol.thickness = depth
        bev = o.modifiers.new("bevel", "BEVEL")
        bev.width = 0.03
        bev.segments = 3
        bev.limit_method = "ANGLE"
        o.data.materials.append(material)
        o.parent = r
        o.select_set(False)
        return o

    shield("shield_outer", 1.0, 0.2, 0.0, steel)
    shield("shield_inner", 0.8, 0.1, -0.12, green)
    sphere(0.3, (0, -0.3, -0.12), water, r, scale=(1, 0.8, 1))
    cone(0.29, 0, 0.42, (0, -0.3, 0.24), water, r)
    export("poolguard")


# ---------------------------------------------------------------- AstraOS: CPU on a circuit board

def build_astraos():
    reset_scene()
    r = root("astraos")
    random.seed(3)
    pcb = mat("pcb", hex_rgb("#0b2e1f"), 0.1, 0.6)
    trace = mat("trace", hex_rgb("#fb923c"), 0.0, 0.3, hex_rgb("#fb923c"), 3.0)
    package = mat("package", hex_rgb("#1f2937"), 0.3, 0.4)
    die = mat("die", hex_rgb("#94a3b8"), 1.0, 0.15)
    pin = mat("pin", hex_rgb("#e5b454"), 1.0, 0.3)

    cube((2.4, 2.4, 0.06), (0, 0, -0.1), pcb, r, bevel=0.02)
    for _ in range(26):
        horiz = random.random() > 0.5
        length = random.uniform(0.3, 0.9)
        edge = random.choice([-1, 1]) * random.uniform(0.85, 1.1)
        off = random.uniform(-1.05, 1.05)
        loc = (edge, off, -0.06) if horiz else (off, edge, -0.06)
        size = (length, 0.025, 0.012) if horiz else (0.025, length, 0.012)
        cube(size, loc, trace, r, bevel=0)

    cube((1.3, 1.3, 0.14), (0, 0, 0.02), package, r, bevel=0.03)
    cube((0.7, 0.7, 0.06), (0, 0, 0.11), die, r, bevel=0.015)
    n = 11
    for i in range(n):
        t = -0.55 + i * (1.1 / (n - 1))
        for sx, sy, rot in ((t, 0.73, 0), (t, -0.73, 0), (0.73, t, 1), (-0.73, t, 1)):
            size = (0.05, 0.18, 0.025) if rot == 0 else (0.18, 0.05, 0.025)
            cube(size, (sx, sy, -0.04), pin, r, bevel=0)
    r.rotation_euler = (math.radians(65), 0, 0)  # tilt the board up toward the viewer
    export("astraos")


# ---------------------------------------------------------------- ml_visualizer: 3D bar chart

def build_mlviz():
    reset_scene()
    r = root("mlviz")
    base = mat("base", hex_rgb("#111827"), 0.4, 0.35)
    axis = mat("axis", (1, 1, 1), 0, 0.3, (1, 1, 1), 2.0)
    ramp = ["#6366f1", "#8b5cf6", "#d946ef", "#f43f5e", "#f97316"]
    ramp_mats = [mat(f"bar{i}", hex_rgb(c), 0.2, 0.3, hex_rgb(c), 0.9) for i, c in enumerate(ramp)]

    cube((2.2, 2.2, 0.08), (0, 0, -0.9), base, r, bevel=0.03)
    n, step = 5, 0.38
    for i in range(n):
        for j in range(n):
            x, y = (i - 2) * step, (j - 2) * step
            h = 0.15 + 1.6 * math.exp(-((x - 0.2) ** 2 + (y + 0.1) ** 2) / 0.35)
            m = ramp_mats[min(4, int(h / 1.75 * 5))]
            cube((0.26, 0.26, h), (x, y, -0.86 + h / 2), m, r, bevel=0.015)
    cylinder(0.012, 2.1, (-1.05, -1.05, 0.15), axis, r, bevel=0)
    cylinder(0.012, 2.1, (0, -1.05, -0.86), axis, r, rot=(0, math.radians(90), 0), bevel=0)
    cylinder(0.012, 2.1, (-1.05, 0, -0.86), axis, r, rot=(math.radians(90), 0, 0), bevel=0)
    export("mlviz")


# ---------------------------------------------------------------- asteroids

def build_asteroid(seed):
    reset_scene()
    r = root(f"asteroid{seed}")
    rock = mat("rock", hex_rgb("#5b5047"), 0.0, 0.92)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=1.0)
    o = bpy.context.active_object
    bm = bmesh.new()
    bm.from_mesh(o.data)
    off = Vector((seed * 13.1, seed * 7.7, seed * 3.3))
    stretch = Vector((random.uniform(0.7, 1.3), random.uniform(0.7, 1.1), random.uniform(0.6, 1.0)))
    for v in bm.verts:
        p = v.co.copy()
        d = noise.fractal(p * 1.3 + off, 0.6, 2.1, 4) * 0.35
        crater = max(0.0, noise.cell(p * 2.2 + off) - 0.75) * -0.8
        v.co = Vector((p.x * stretch.x, p.y * stretch.y, p.z * stretch.z)) * (1 + d + crater)
    bm.to_mesh(o.data)
    bm.free()
    dec = o.modifiers.new("decimate", "DECIMATE")
    dec.ratio = 0.25
    finish(o, rock, r, smooth=False)
    export(f"asteroid{seed}")


if __name__ == "__main__":
    build_polychat()
    build_ragg()
    build_equiclear()
    build_poolguard()
    build_astraos()
    build_mlviz()
    for s in (1, 2, 3):
        random.seed(s)
        build_asteroid(s)
