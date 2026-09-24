"""Procedurally models the featured-project centerpieces and exports them as GLB.

Run headless:  blender --background --factory-startup --python scripts/blender/build_models.py -- <out_dir>
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

OUT_DIR = Path(sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "public/models")
OUT_DIR.mkdir(parents=True, exist_ok=True)
FONT = Path("C:/Windows/Fonts/ariblk.ttf")


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


def cone(r1, r2, depth, loc, material, parent, rot=(0, 0, 0), verts=32):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot, vertices=verts)
    return finish(bpy.context.active_object, material, parent)


def torus(major, minor, loc, material, parent, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc, rotation=rot,
                                     major_segments=64, minor_segments=16)
    return finish(bpy.context.active_object, material, parent)


def link(a, b, radius, material, parent):
    """A rod from point a to point b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=d.length, location=(a + b) / 2, rotation=rot, vertices=16)
    return finish(bpy.context.active_object, material, parent)


def text(body, loc, material, parent, size=0.4, extrude=0.03, rot=(math.radians(90), 0, 0)):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    o = bpy.context.active_object
    o.data.body = body
    o.data.size = size
    o.data.extrude = extrude
    o.data.align_x = "CENTER"
    o.data.align_y = "CENTER"
    o.data.resolution_u = 2
    if FONT.exists():
        o.data.font = bpy.data.fonts.load(str(FONT), check_existing=True)
    bpy.ops.object.convert(target="MESH")
    return finish(bpy.context.active_object, material, parent, smooth=False)


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


# Blender is Z-up; the exporter converts to Y-up. Models are authored facing -Y (toward the viewer)
# and fit in roughly a 2.4 m cube around the origin.
FACE = (math.radians(90), 0, 0)  # rotates a Z-axis primitive to face -Y

# ---------------------------------------------------------------- Cortex: an AI desktop assistant


def build_cortex():
    reset_scene()
    r = root("cortex")
    shell = mat("shell", hex_rgb("#e5e7eb"), 0.2, 0.35)
    screen = mat("screen", hex_rgb("#0b1020"), 0.1, 0.2)
    wave = mat("wave", hex_rgb("#22d3ee"), 0, 0.2, hex_rgb("#22d3ee"), 4.0)
    bubble = mat("bubble", hex_rgb("#8b5cf6"), 0.1, 0.25, hex_rgb("#8b5cf6"), 0.8)
    white = mat("white", (1, 1, 1), 0, 0.3, (1, 1, 1), 3.0)

    cube((2.1, 0.14, 1.35), (0, 0, 0.3), shell, r, bevel=0.06)
    cube((1.9, 0.06, 1.15), (0, -0.07, 0.3), screen, r, bevel=0.02)
    for i, h in enumerate((0.25, 0.55, 0.85, 0.5, 0.7, 0.3, 0.6)):  # voice waveform on the screen
        cube((0.1, 0.03, h), (-0.6 + i * 0.2, -0.11, 0.3), wave, r, bevel=0.02)
    cube((0.18, 0.18, 0.5), (0, 0.05, -0.55), shell, r, bevel=0.03)
    cube((0.9, 0.5, 0.06), (0, 0.05, -0.82), shell, r, bevel=0.03)
    sphere(0.42, (0.95, -0.2, 1.05), bubble, r, scale=(1.2, 0.45, 0.8))
    cone(0.12, 0, 0.3, (0.62, -0.2, 0.78), bubble, r, rot=(0, math.radians(-135), 0))
    for i in range(3):
        sphere(0.06, (0.8 + i * 0.15, -0.42, 1.05), white, r, segments=12)
    export("cortex")


# ---------------------------------------------------------------- commit-orchestra: an agent-driven git graph


def build_orchestra():
    reset_scene()
    r = root("orchestra")
    main = mat("main", hex_rgb("#ff7a3d"), 0.2, 0.3, hex_rgb("#ff7a3d"), 0.6)
    branch = mat("branch", hex_rgb("#2dd4bf"), 0.2, 0.3, hex_rgb("#2dd4bf"), 0.6)
    ok = mat("ok", hex_rgb("#22c55e"), 0.1, 0.3, hex_rgb("#22c55e"), 1.5)
    white = mat("white", (1, 1, 1), 0, 0.3, (1, 1, 1), 2.0)

    trunk = [(-0.4, 0, z) for z in (-1.0, -0.35, 0.3, 0.95)]
    for a, b in zip(trunk, trunk[1:]):
        link(a, b, 0.06, main, r)
    for p in trunk:
        sphere(0.17, p, main, r, segments=20)
    side = [(0.45, 0, -0.05), (0.45, 0, 0.55)]
    link(trunk[1], side[0], 0.06, branch, r)
    link(side[0], side[1], 0.06, branch, r)
    link(side[1], trunk[3], 0.06, branch, r)  # merged back
    for p in side:
        sphere(0.15, p, branch, r, segments=20)
    cylinder(0.3, 0.08, (0.95, -0.05, 1.05), ok, r, rot=FACE)  # CI badge with a check mark
    cube((0.08, 0.04, 0.2), (0.88, -0.12, 1.0), white, r, rot=(0, math.radians(45), 0), bevel=0.01)
    cube((0.08, 0.04, 0.34), (1.0, -0.12, 1.06), white, r, rot=(0, math.radians(-40), 0), bevel=0.01)
    export("orchestra")


# ---------------------------------------------------------------- HireHunt: briefcase + magnifier


def build_hirehunt():
    reset_scene()
    r = root("hirehunt")
    leather = mat("leather", hex_rgb("#8b5a2b"), 0.1, 0.5)
    strap = mat("strap", hex_rgb("#4a2f17"), 0.1, 0.5)
    brass = mat("brass", hex_rgb("#e0b252"), 1.0, 0.25)
    glass = mat("glass", hex_rgb("#7dd3fc"), 0.0, 0.05, hex_rgb("#38bdf8"), 1.2)
    rim = mat("rim", hex_rgb("#1f2937"), 0.4, 0.3)

    cube((1.8, 0.6, 1.2), (-0.2, 0.1, -0.35), leather, r, bevel=0.1)
    cube((1.82, 0.62, 0.1), (-0.2, 0.1, -0.05), strap, r, bevel=0.02)
    torus(0.25, 0.05, (-0.2, 0.1, 0.35), strap, r, rot=FACE)
    for x in (-0.75, 0.35):
        cube((0.16, 0.05, 0.12), (x, -0.22, -0.05), brass, r, bevel=0.01)
    torus(0.42, 0.07, (0.65, -0.35, 0.55), rim, r, rot=FACE)
    cylinder(0.4, 0.04, (0.65, -0.35, 0.55), glass, r, rot=FACE)
    link((0.95, -0.35, 0.25), (1.35, -0.35, -0.2), 0.08, rim, r)
    export("hirehunt")


# ---------------------------------------------------------------- swiggy-cli: takeaway box + terminal


def build_swiggy():
    reset_scene()
    r = root("swiggy")
    box_mat = mat("box", hex_rgb("#fc8019"), 0.1, 0.45)
    paper = mat("paper", hex_rgb("#fff3e6"), 0, 0.7)
    term = mat("term", hex_rgb("#111827"), 0.3, 0.3)
    bar = mat("bar", hex_rgb("#374151"), 0.3, 0.4)
    green = mat("green", hex_rgb("#4ade80"), 0, 0.3, hex_rgb("#4ade80"), 3.0)
    lights = [mat(f"light{i}", hex_rgb(c), 0, 0.3, hex_rgb(c), 2.0) for i, c in enumerate(("#ef4444", "#f59e0b", "#22c55e"))]

    cone(0.75, 0.55, 1.1, (-0.55, 0.2, -0.35), box_mat, r, rot=(0, 0, math.radians(45)), verts=4)
    cube((0.8, 0.8, 0.08), (-0.55, 0.2, 0.25), paper, r, rot=(0, 0, math.radians(45)), bevel=0.02)
    torus(0.28, 0.035, (-0.55, 0.2, 0.45), paper, r, rot=FACE)
    cube((1.4, 0.12, 1.0), (0.55, -0.25, 0.2), term, r, bevel=0.06)
    cube((1.4, 0.14, 0.16), (0.55, -0.25, 0.64), bar, r, bevel=0.03)
    for i, m in enumerate(lights):
        sphere(0.045, (0.0 + i * 0.12, -0.33, 0.64), m, r, segments=12)
    text(">_", (0.3, -0.33, 0.25), green, r, size=0.42)
    export("swiggy")


# ---------------------------------------------------------------- AgentVault: a vault door for AI agents


def build_agentvault():
    reset_scene()
    r = root("agentvault")
    steel = mat("steel", hex_rgb("#9ca3af"), 1.0, 0.3)
    dark = mat("vault_dark", hex_rgb("#374151"), 0.8, 0.35)
    glow = mat("glow", hex_rgb("#a78bfa"), 0, 0.2, hex_rgb("#a78bfa"), 3.0)

    cube((2.1, 0.3, 2.1), (0, 0.2, 0), dark, r, bevel=0.08)
    cylinder(0.92, 0.3, (0, -0.05, 0), steel, r, rot=FACE)
    torus(0.92, 0.07, (0, -0.2, 0), dark, r, rot=FACE)
    for i in range(10):  # bolts around the rim
        a = i / 10 * math.tau
        cylinder(0.06, 0.1, (math.cos(a) * 0.78, -0.22, math.sin(a) * 0.78), dark, r, rot=FACE)
    torus(0.38, 0.045, (0, -0.32, 0), steel, r, rot=FACE)
    for i in range(3):  # handle wheel spokes
        a = i / 3 * math.pi
        link((math.cos(a) * 0.42, -0.32, math.sin(a) * 0.42), (-math.cos(a) * 0.42, -0.32, -math.sin(a) * 0.42),
             0.035, steel, r)
    cylinder(0.12, 0.14, (0, -0.34, 0), glow, r, rot=FACE)
    export("agentvault")


if __name__ == "__main__":
    # Featured projects, in island-gallery order. Keep in sync with `projects` in src/content.ts.
    build_cortex()
    build_orchestra()
    build_hirehunt()
    build_swiggy()
    build_agentvault()
