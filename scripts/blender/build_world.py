"""Builds the drivable island, exports it for the web.

Outputs (in <out_dir>):
  world.glb   static scenery (joined by material) + named dynamic props + animated props
  car.glb     chassis ("body") and one wheel ("wheel"), forward = +X
  world.json  physics colliders, dynamic prop shapes, interaction zones, spawn point

Blender is Z-up; everything written to world.json is already converted to three.js Y-up:
  three(x, y, z) = blender(x, z, -y), and a Blender rotation about Z equals a three rotation about Y.

Run: blender --background --factory-startup --python scripts/blender/build_world.py -- <models_dir> <out_dir>
"""

import json
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector, noise

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["public/models", "public/world"]
MODELS, OUT = Path(args[0]), Path(args[1])
OUT.mkdir(parents=True, exist_ok=True)
FONT = Path("C:/Windows/Fonts/ariblk.ttf")

GROUND = 0.5  # top of the grass
ISLAND_R = 38.0
ROAD_IN, ROAD_OUT = 13.0, 16.4
ROAD_MID = (ROAD_IN + ROAD_OUT) / 2
VIEW = Vector((0.7071, -0.7071, 0))  # direction toward the game camera (three: +x, +z)

random.seed(4)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()

colliders = []  # static
dynamic = []  # props with rigid bodies
zones = []
animated = []  # names of nodes three.js animates
clearings = []  # (blender x, y, radius): no trees, no grass


def t3(v):
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


def static_box(center, size, rot_z=0.0):
    colliders.append({"shape": "box", "pos": t3(center), "half": [size[0] / 2, size[2] / 2, size[1] / 2],
                      "rotY": round(rot_z, 4)})


def static_cyl(center, radius, height):
    colliders.append({"shape": "cyl", "pos": t3(center), "radius": radius, "halfHeight": height / 2})


# ---------------------------------------------------------------- materials


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


_mats = {}


def mat(name, hexcol, rough=0.8, metal=0.0, emit=0.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except AttributeError:
        pass
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*srgb(hexcol), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*srgb(hexcol), 1)
        b.inputs["Emission Strength"].default_value = emit
    _mats[name] = m
    return m


GRASS = mat("grass", "#8ccb5e", 0.95)
SAND = mat("sand", "#f1d7a1", 0.95)
ROAD = mat("road", "#3b3f4b", 0.9)
PAINT = mat("paint", "#f6f2ea", 0.7)
STONE = mat("stone", "#ddd6c8", 0.9)
CURB = mat("curb", "#b9b2a6", 0.9)
ORANGE = mat("orange", "#ff6b2c", 0.45)
ORANGE_GLOW = mat("orange_glow", "#ff7a3d", 0.4, emit=4)
DARK = mat("dark", "#22242c", 0.5)
SCREEN = mat("screen", "#10131a", 0.3)
TRUNK = mat("trunk", "#7a4b2a", 0.9)
LEAF_A = mat("leaf_a", "#5e9c3f", 0.95)
LEAF_B = mat("leaf_b", "#71b34b", 0.95)
LEAF_C = mat("leaf_c", "#4c8a36", 0.95)
ROCK = mat("rock", "#9a9ba0", 0.95)
WOOD = mat("wood", "#b27a45", 0.85)
WALL = mat("wall", "#e9e4da", 0.6)
BRICK = mat("brick", "#c8744a", 0.8)
ROOF = mat("roof", "#4a3b36", 0.8)
RED = mat("red", "#e2412f", 0.5)
WHITE = mat("white", "#f7f4ee", 0.6)
METAL = mat("metal", "#c9ccd4", 0.3, 1.0)
WARM_GLOW = mat("warm_glow", "#ffd36b", 0.4, emit=6)
CYAN_GLOW = mat("cyan_glow", "#5ee6ff", 0.3, emit=4)
RED_GLOW = mat("red_glow", "#ff2a2a", 0.3, emit=10)
FIRE = mat("fire", "#ff8a1c", 0.3, emit=12)
PAD = mat("pad", "#ffffff", 0.5, emit=1.2)


# ---------------------------------------------------------------- primitives


def finish(o, m, flat=True):
    o.data.materials.clear()
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = not flat
    return o


def box(size, loc, m, rot_z=0.0, bevel=0.0, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot or (0, 0, rot_z))
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new("bevel", "BEVEL")
        b.width, b.segments = bevel, 2
    return finish(o, m)


def cyl(r, d, loc, m, rot=(0, 0, 0), verts=12, r2=None, fill="NGON", smooth=False):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d, location=loc, rotation=rot, vertices=verts,
                                            end_fill_type=fill)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=d, location=loc, rotation=rot, vertices=verts)
    return finish(bpy.context.active_object, m, flat=not smooth)


def ico(r, loc, m, sub=1, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    o = bpy.context.active_object
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, m)


def text_mesh(body, loc, m, size=1.0, extrude=0.1, rot=(math.radians(90), 0, 0), align="CENTER"):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    o = bpy.context.active_object
    o.data.body = body
    o.data.size = size
    o.data.extrude = extrude
    o.data.align_x = align
    o.data.align_y = "BOTTOM"
    o.data.resolution_u = 2  # low-poly curves keep the GLB small
    if FONT.exists():
        o.data.font = bpy.data.fonts.load(str(FONT), check_existing=True)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.active_object
    return finish(o, m)


def floor_text(body, center, m, size, facing=VIEW):
    """Big letters painted on the ground, readable from the game camera."""
    ang = math.atan2(facing.y, facing.x) + math.pi / 2
    o = text_mesh(body, (0, 0, 0), m, size=size, extrude=0.02, rot=(0, 0, 0))
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    o.location = (center[0], center[1], GROUND + 0.03)
    o.rotation_euler = (0, 0, ang)
    clearings.append((center[0], center[1], o.dimensions.x / 2 + 0.4))  # keep grass off painted labels
    return o


def polar(r, deg, z=GROUND):
    a = math.radians(deg)
    return Vector((math.cos(a) * r, math.sin(a) * r, z))


# ---------------------------------------------------------------- terrain


def blob_disc(name, radius, depth, top, m, wobble, seed, verts=96):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=(0, 0, top - depth / 2), vertices=verts)
    o = bpy.context.active_object
    o.name = name
    for v in o.data.vertices:
        a = math.atan2(v.co.y, v.co.x)
        k = 1 + wobble * noise.noise(Vector((math.cos(a) * 1.4 + seed, math.sin(a) * 1.4, seed)))
        v.co.x *= k
        v.co.y *= k
    return finish(o, m)


grass = blob_disc("col_grass", ISLAND_R, 1.2, GROUND, GRASS, 0.07, 3.0)
sand = blob_disc("col_sand", ISLAND_R + 4, 1.4, GROUND - 0.25, SAND, 0.08, 3.0)
# The ground is a trimesh collider built from these two meshes in three.js.
colliders.append({"shape": "trimesh", "node": "col_grass"})
colliders.append({"shape": "trimesh", "node": "col_sand"})


def annulus(name, r0, r1, z, m, seg=160):
    bm = bmesh.new()
    rows = []
    for i in range(seg):
        a = i / seg * math.tau
        rows.append((bm.verts.new((math.cos(a) * r0, math.sin(a) * r0, z)),
                     bm.verts.new((math.cos(a) * r1, math.sin(a) * r1, z))))
    for i in range(seg):
        a0, b0 = rows[i]
        a1, b1 = rows[(i + 1) % seg]
        bm.faces.new((a0, b0, b1, a1))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return finish(o, m)


annulus("road_ring", ROAD_IN, ROAD_OUT, GROUND + 0.015, ROAD)
annulus("curb_in", ROAD_IN - 0.35, ROAD_IN, GROUND + 0.03, CURB)
annulus("curb_out", ROAD_OUT, ROAD_OUT + 0.35, GROUND + 0.03, CURB)
for i in range(48):
    box((1.0, 0.16, 0.02), polar(ROAD_MID, i * 7.5, GROUND + 0.03), PAINT, rot_z=math.radians(i * 7.5 + 90))

ZONE_R = 26.0
spoke_len = ZONE_R - 5 - ROAD_OUT
for deg in (0, 90, 180, 270):
    box((ROAD_IN - 6.4, 3.4, 0.03), polar((ROAD_IN + 6.2) / 2, deg, GROUND + 0.012), ROAD, rot_z=math.radians(deg))
    box((spoke_len + 0.4, 3.4, 0.03), polar(ROAD_OUT + spoke_len / 2, deg, GROUND + 0.012), ROAD,
        rot_z=math.radians(deg))

cyl(6.2, 0.08, (0, 0, GROUND + 0.02), STONE, verts=64)
cyl(6.5, 0.05, (0, 0, GROUND + 0.005), CURB, verts=64)

# ---------------------------------------------------------------- spawn: the name, knockable


def letters(word, center, size, facing, prefix, m):
    along = Vector((-facing.y, facing.x, 0))  # the camera's right-hand direction
    ang = math.atan2(facing.y, facing.x) + math.pi / 2
    objs = []
    for ch in word:
        o = text_mesh(ch, (0, 0, 0), m, size=size, extrude=0.45, rot=(math.radians(90), 0, 0))
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
        objs.append(o)
    widths = [o.dimensions.x for o in objs]
    gap = size * 0.12
    total = sum(widths) + gap * (len(objs) - 1)
    cursor = -total / 2
    for i, (o, w) in enumerate(zip(objs, widths)):
        offset = cursor + w / 2
        cursor += w + gap
        p = center + along * offset
        # Local axes: x = width, y = letter height (stood up by the 90° X rotation), z = extrude depth.
        o.location = (p.x, p.y, GROUND + o.dimensions.y / 2 + 0.01)
        o.rotation_euler = (math.radians(90), 0, ang)
        o.name = f"{prefix}{i}"
        dynamic.append({"node": o.name, "shape": "box", "group": "letter", "mass": 1.2,
                        "half": [o.dimensions.x / 2, o.dimensions.z / 2, o.dimensions.y / 2]})
    return objs


letters("ANIKEAT", Vector((0, 0.6, 0)), 2.4, VIEW, "dyn_letter_", ORANGE)
floor_text("YADAV  ·  STUDENT DEVELOPER", Vector((1.4, -1.4, 0)), WHITE, 0.5)

# traffic cones around the plaza, also knockable
for i in range(10):
    p = polar(5.3, i * 36 + 18, GROUND)
    c = cyl(0.32, 0.9, (p.x, p.y, GROUND + 0.45), ORANGE, verts=10, r2=0.05)
    band = cyl(0.24, 0.12, (p.x, p.y, GROUND + 0.5), WHITE, verts=10)
    base = box((0.7, 0.7, 0.08), (p.x, p.y, GROUND + 0.04), DARK)
    bpy.ops.object.select_all(action="DESELECT")
    for o in (c, band, base):
        o.select_set(True)
    bpy.context.view_layer.objects.active = c
    bpy.ops.object.join()
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    c.name = f"dyn_cone_{i}"
    dynamic.append({"node": c.name, "shape": "box", "group": "cone", "mass": 0.25, "half": [0.35, 0.47, 0.35]})

spawn = polar(ROAD_MID, -60)
spawn_heading = math.radians(-60 + 90)

# ---------------------------------------------------------------- EAST: projects hangar

HX = ZONE_R + 3
hangar = cyl(6.5, 12, (HX + 1.5, 0, GROUND), WALL, rot=(0, math.radians(90), 0), verts=32, fill="NOTHING")
sol = hangar.modifiers.new("solidify", "SOLIDIFY")
sol.thickness = 0.35
for i in range(5):
    torus_x = HX + 1.5 - 6 + i * 3
    bpy.ops.mesh.primitive_torus_add(major_radius=6.55, minor_radius=0.12, location=(torus_x, 0, GROUND),
                                     rotation=(0, math.radians(90), 0), major_segments=48, minor_segments=6)
    finish(bpy.context.active_object, DARK)
box((12.5, 14, 0.12), (HX + 1.5, 0, GROUND + 0.06), mat("hangar_floor", "#2c2f38", 0.4))
static_box(Vector((HX + 1.5, 6.4, GROUND + 2)), (12, 0.8, 4))
static_box(Vector((HX + 1.5, -6.4, GROUND + 2)), (12, 0.8, 4))
static_box(Vector((HX + 7.8, 0, GROUND + 2)), (0.6, 13, 4))  # back wall blocks the far end
box((0.3, 13, 6.5), (HX + 7.7, 0, GROUND + 3.2), WALL)
sign = text_mesh("PROJECTS", (HX - 4.6, 0, GROUND + 7.2), ORANGE_GLOW, size=1.4, extrude=0.18,
                 rot=(math.radians(90), 0, math.radians(-90)))
floor_text("PROJECTS", Vector((ZONE_R - 6.5, -2.5, 0)), WHITE, 1.4)

project_slugs = ["polychat", "ragg", "equiclear", "poolguard", "astraos", "mlviz"]
for i, slug in enumerate(project_slugs):
    y = 6.25 - i * 2.5
    px = HX + 2.5
    cyl(0.95, 0.8, (px, y, GROUND + 0.4), WHITE, verts=24)
    cyl(1.0, 0.08, (px, y, GROUND + 0.82), ORANGE_GLOW, verts=24)
    static_cyl(Vector((px, y, GROUND + 0.4)), 1.0, 0.8)
    pad = cyl(0.95, 0.03, (px - 3.2, y, GROUND + 0.075), PAD, verts=32)
    pad.name = f"pad_{slug}"
    animated.append(pad.name)
    zones.append({"id": f"project:{slug}", "kind": "project", "slug": slug, "pos": t3((px - 3.2, y, GROUND)),
                  "radius": 1.25})
    f = MODELS / f"{slug}.glb"
    if f.exists():
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(f))
        roots = [o for o in set(bpy.data.objects) - before if o.parent is None]
        for o in roots:
            o.location = (px, y, GROUND + 2.0)
            o.scale = (0.6, 0.6, 0.6)
            o.rotation_euler.z += math.radians(-90)
            o.name = f"project_{slug}"
            animated.append(o.name)

# ---------------------------------------------------------------- WEST: skills billboard + blocks

BX = -(ZONE_R + 2)
for y in (-4.4, 4.4):
    cyl(0.2, 7, (BX, y, GROUND + 3.5), METAL, verts=10)
    static_cyl(Vector((BX, y, GROUND + 3.5)), 0.3, 7)
box((0.4, 10.5, 5.2), (BX, 0, GROUND + 6.6), DARK, bevel=0.1)
box((0.1, 9.8, 4.6), (BX + 0.22, 0, GROUND + 6.6), SCREEN)
text_mesh("SKILLS", (BX + 0.3, 0, GROUND + 7.7), CYAN_GLOW, size=1.2, extrude=0.05,
          rot=(math.radians(90), 0, math.radians(90)))
chip_cols = ["#3178c6", "#f7df1e", "#61dafb", "#3776ab", "#8247e5", "#dea584", "#ff6b2c", "#e34f26",
             "#00b4ab", "#ee4c2c", "#10b981", "#a855f7"]
for i, c in enumerate(chip_cols):
    row, col = divmod(i, 6)
    box((0.15, 1.2, 0.65), (BX + 0.3, -3.75 + col * 1.5, GROUND + 6.1 - row * 0.95),
        mat(f"chip{i}", c, 0.4, emit=2.5), bevel=0.08)
floor_text("SKILLS", Vector((-(ZONE_R - 6.5), 2.5, 0)), WHITE, 1.4)
zones.append({"id": "skills", "kind": "skills", "pos": t3((BX + 4.5, 0, GROUND)), "radius": 2.6})
pad = cyl(2.2, 0.03, (BX + 4.5, 0, GROUND + 0.075), PAD, verts=48)
pad.name = "pad_skills"
animated.append(pad.name)

# a pyramid of skill blocks to smash
block_labels = ["TS", "PY", "C", "JS", "RS", "SOL", "JV", "SQL", "ML", "3D"]
k = 0
for level, count in enumerate((4, 3, 2, 1)):
    for j in range(count):
        if k >= len(block_labels):
            break
        x = BX + 8.5
        y = -2.1 + j * 1.4 + level * 0.7 - 6.5
        z = GROUND + 0.62 + level * 1.24
        b = box((1.2, 1.2, 1.2), (x, y, z), mat(f"blk{k}", chip_cols[k % len(chip_cols)], 0.5), bevel=0.08)
        label = text_mesh(block_labels[k], (x + 0.61, y, z - 0.25), WHITE, size=0.5, extrude=0.03,
                          rot=(math.radians(90), 0, math.radians(90)))
        bpy.ops.object.select_all(action="DESELECT")
        b.select_set(True)
        label.select_set(True)
        bpy.context.view_layer.objects.active = b
        bpy.ops.object.join()
        bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
        b.name = f"dyn_block_{k}"
        dynamic.append({"node": b.name, "shape": "box", "group": "block", "mass": 0.6, "half": [0.6, 0.6, 0.6]})
        k += 1

# ---------------------------------------------------------------- SOUTH: contact

CY = -(ZONE_R + 1)
cyl(0.13, 1.7, (2.4, CY, GROUND + 0.85), WOOD, verts=8)
box((1.2, 0.75, 0.65), (2.4, CY, GROUND + 1.95), RED, bevel=0.22)
flag = box((0.07, 0.09, 0.65), (3.05, CY + 0.32, GROUND + 2.45), mat("flag", "#ffd400", 0.5))
static_cyl(Vector((2.4, CY, GROUND + 1)), 0.5, 2)
zones.append({"id": "contact", "kind": "contact", "pos": t3((2.4, CY + 3.2, GROUND)), "radius": 2.2})
pad = cyl(1.9, 0.03, (2.4, CY + 3.2, GROUND + 0.075), PAD, verts=48)
pad.name = "pad_contact"
animated.append(pad.name)
floor_text("CONTACT", Vector((-3.2, CY + 6.5, 0)), WHITE, 1.4)

tx, ty = -4.0, CY - 2.5
for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
    bot = Vector((tx + dx * 1.4, ty + dy * 1.4, GROUND))
    top = Vector((tx + dx * 0.25, ty + dy * 0.25, GROUND + 12))
    d = top - bot
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    cyl(0.09, d.length, (bot + top) / 2, RED if dx > 0 else WHITE, rot=rot, verts=6)
    static_cyl(Vector((bot.x, bot.y, GROUND + 1)), 0.25, 2)
for s in range(7):
    z = GROUND + 1.4 + s * 1.55
    w = 1.4 - (z - GROUND) / 12 * 1.15
    for (ox, oy, sx, sy) in ((0, -w, w * 2, 0.08), (0, w, w * 2, 0.08), (-w, 0, 0.08, w * 2), (w, 0, 0.08, w * 2)):
        box((sx, sy, 0.08), (tx + ox, ty + oy, z), WHITE)
beacon = ico(0.38, (tx, ty, GROUND + 12.3), RED_GLOW, sub=2)
beacon.name = "beacon"
animated.append(beacon.name)

# ---------------------------------------------------------------- NORTH: about cabin + campfire

AX, AY = 0, ZONE_R + 2.5
box((6, 4.6, 3.2), (AX, AY, GROUND + 1.6), BRICK, bevel=0.05)
cyl(4.6, 2.6, (AX, AY, GROUND + 4.5), ROOF, rot=(0, 0, math.radians(45)), verts=4, r2=0.2)
box((1.1, 0.12, 2.0), (AX, AY - 2.32, GROUND + 1.0), DARK)
for dx in (-1.9, 1.9):
    box((1.0, 0.12, 0.9), (AX + dx, AY - 2.32, GROUND + 1.9), WARM_GLOW)
box((0.8, 0.8, 1.6), (AX + 1.8, AY + 1.2, GROUND + 5.2), BRICK)
static_box(Vector((AX, AY, GROUND + 1.6)), (6.2, 4.8, 3.2))
floor_text("ABOUT ME", Vector((-3.0, AY - 6.8, 0)), WHITE, 1.4)
zones.append({"id": "about", "kind": "about", "pos": t3((AX, AY - 4.6, GROUND)), "radius": 2.2})
pad = cyl(1.9, 0.03, (AX, AY - 4.6, GROUND + 0.075), PAD, verts=48)
pad.name = "pad_about"
animated.append(pad.name)

fx, fy = AX + 6, AY - 3.5
for i in range(4):
    cyl(0.15, 1.5, (fx, fy, GROUND + 0.2), WOOD, rot=(math.radians(90), 0, math.radians(i * 45)), verts=6)
fire = cyl(0.5, 1.2, (fx, fy, GROUND + 0.75), FIRE, verts=6, r2=0.0)
fire.name = "fire"
animated.append(fire.name)
static_cyl(Vector((fx, fy, GROUND + 0.5)), 0.9, 1)
for i in range(3):
    a = math.radians(i * 120 + 20)
    box((1.5, 0.5, 0.45), (fx + math.cos(a) * 2.2, fy + math.sin(a) * 2.2, GROUND + 0.22), WOOD,
        rot_z=a + math.pi / 2, bevel=0.05)

# ---------------------------------------------------------------- lighthouse (south-west cape)

LX, LY = -26, -25
for s in range(6):
    r0, r1 = 1.5 - s * 0.14, 1.5 - (s + 1) * 0.14
    cyl(r0, 1.5, (LX, LY, GROUND + 0.75 + s * 1.5), RED if s % 2 else WHITE, verts=20, r2=r1)
lamp = cyl(0.75, 1.1, (LX, LY, GROUND + 9.55), WARM_GLOW, verts=20)
lamp.name = "lighthouse_lamp"
animated.append(lamp.name)
cyl(1.0, 0.9, (LX, LY, GROUND + 10.55), DARK, verts=20, r2=0.1)
static_cyl(Vector((LX, LY, GROUND + 4)), 1.5, 8)
zones.append({"id": "lighthouse", "kind": "lighthouse", "pos": t3((LX + 3.2, LY + 3.2, GROUND)), "radius": 2.0})
pad = cyl(1.6, 0.03, (LX + 3.2, LY + 3.2, GROUND + 0.075), PAD, verts=48)
pad.name = "pad_lighthouse"
animated.append(pad.name)

# ---------------------------------------------------------------- signpost at the spawn


def signpost(pos, entries):
    cyl(0.1, 3.2, (pos.x, pos.y, GROUND + 1.6), WOOD, verts=8)
    static_cyl(Vector((pos.x, pos.y, GROUND + 1)), 0.2, 2)
    for i, (label, deg) in enumerate(entries):
        z = GROUND + 2.8 - i * 0.55
        a = math.radians(deg)
        c = Vector((pos.x + math.cos(a) * 0.9, pos.y + math.sin(a) * 0.9, z))
        box((1.9, 0.08, 0.42), c, WOOD, rot_z=a, bevel=0.03)
        side = Vector((math.cos(a - math.pi / 2), math.sin(a - math.pi / 2), 0)) * 0.05
        text_mesh(label, c + side, WHITE, size=0.26, extrude=0.01, rot=(math.radians(90), 0, a))


signpost(polar(ROAD_OUT + 1.6, -48), [("PROJECTS", 0), ("ABOUT", 90), ("SKILLS", 180), ("CONTACT", 270)])

# ================================================================ playground


def clear(x, y, r):
    clearings.append((x, y, r))


# Buildings and zone structures: keep trees and grass off their footprints.
clear(HX + 1.5, 0, 7.5)
clear(BX + 2, 0, 5.5)
clear(BX + 8.5, -5, 3.5)
clear(AX, AY, 4.2)
clear(fx, fy, 2.6)
clear(2.4, CY, 1.5)
clear(tx, ty, 2.2)
clear(LX, LY, 2.4)


def join_as(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        apply_all_modifiers(o)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    o.name = name
    return o


def apply_all_modifiers(o):
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


# ---------------------------------------------------------------- bowling alley (north-east)

PIN_WHITE = mat("pin_white", "#fbfaf6", 0.35)
PIN_RED = mat("pin_red", "#d9362b", 0.4)
LANE = mat("lane", "#d9a86a", 0.45)
GUTTER = mat("gutter", "#2c2f38", 0.5)
BALL = mat("ball", "#2446a8", 0.12, 0.2)

BOWL_DEG = 45
bowl_dir = Vector((math.cos(math.radians(BOWL_DEG)), math.sin(math.radians(BOWL_DEG)), 0))
bowl_side = Vector((-bowl_dir.y, bowl_dir.x, 0))
lane_start, lane_end = 19.5, 33.0
lane_mid = bowl_dir * ((lane_start + lane_end) / 2)
lane_len = lane_end - lane_start
rot = math.radians(BOWL_DEG)
box((lane_len, 3.4, 0.06), (lane_mid.x, lane_mid.y, GROUND + 0.03), LANE, rot_z=rot)
for k in range(1, 8):  # plank lines
    off = bowl_side * (-1.7 + k * 3.4 / 8)
    box((lane_len, 0.02, 0.01), (lane_mid.x + off.x, lane_mid.y + off.y, GROUND + 0.065), mat("plank", "#b98a52", 0.6),
        rot_z=rot)
for s in (-1, 1):
    g = lane_mid + bowl_side * s * 2.05
    box((lane_len, 0.7, 0.12), (g.x, g.y, GROUND + 0.06), GUTTER, rot_z=rot)
    rail = lane_mid + bowl_side * s * 2.55
    box((lane_len, 0.25, 0.35), (rail.x, rail.y, GROUND + 0.17), WOOD, rot_z=rot, bevel=0.04)
    static_box(Vector((rail.x, rail.y, GROUND + 0.17)), (lane_len, 0.25, 0.35), rot)
back = bowl_dir * (lane_end + 0.6)
box((0.5, 6.0, 2.2), (back.x, back.y, GROUND + 1.1), GUTTER, rot_z=rot, bevel=0.05)
static_box(Vector((back.x, back.y, GROUND + 1.1)), (0.5, 6.0, 2.2), rot)
sign_at = bowl_dir * (lane_end + 0.3)  # on the lane-facing side of the back wall
text_mesh("BOWLING", (sign_at.x, sign_at.y, GROUND + 1.25), ORANGE_GLOW, size=0.75, extrude=0.06,
          rot=(math.radians(90), 0, rot - math.pi / 2))
arrow_mid = bowl_dir * (lane_start + 3.0)
for k in (-2, -1, 0, 1, 2):  # aiming arrows, like a real lane
    a = arrow_mid + bowl_side * (k * 0.55) + bowl_dir * (abs(k) * 0.4)
    cyl(0.14, 0.02, (a.x, a.y, GROUND + 0.07), PAD, rot=(0, 0, rot), verts=3, r2=0.0)
floor_text("BOWLING", bowl_dir * (lane_start - 3.0), WHITE, 1.2)
clear(lane_mid.x, lane_mid.y, 8.5)


def make_pin(name, at):
    profile = [(0.0, 0.0), (0.11, 0.0), (0.16, 0.18), (0.2, 0.36), (0.17, 0.56), (0.1, 0.72), (0.085, 0.82),
               (0.1, 0.94), (0.08, 1.04), (0.0, 1.08)]
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=16,
                   use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    body = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(body)
    finish(body, PIN_WHITE, flat=False)
    stripe1 = cyl(0.103, 0.035, (0, 0, 0.76), PIN_RED, verts=16, smooth=True)
    stripe2 = cyl(0.093, 0.035, (0, 0, 0.84), PIN_RED, verts=16, smooth=True)
    pin = join_as([body, stripe1, stripe2], name)
    pin.location = (at.x, at.y, GROUND + 0.54 + 0.005)
    dynamic.append({"node": name, "shape": "cyl", "group": "pin", "mass": 0.35, "radius": 0.19, "halfHeight": 0.54})


rows = [1, 2, 3, 4]
head = bowl_dir * (lane_end - 3.6)
i = 0
for row, count in enumerate(rows):
    for j in range(count):
        at = head + bowl_dir * (row * 0.62) + bowl_side * ((j - (count - 1) / 2) * 0.7)
        make_pin(f"dyn_pin_{i}", at)
        i += 1

ball_at = bowl_dir * (lane_start + 1.2)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.55, location=(ball_at.x, ball_at.y, GROUND + 0.56), segments=24,
                                     ring_count=12)
ball = finish(bpy.context.active_object, BALL, flat=False)
holes = [cyl(0.07, 0.1, (ball_at.x + dx, ball_at.y - 0.5, GROUND + 0.56 + dz), DARK, rot=(math.radians(90), 0, 0), verts=8)
         for dx, dz in ((0.12, 0.2), (-0.1, 0.24), (0.0, 0.36))]  # finger holes
ball = join_as([ball] + holes, "dyn_ball")
dynamic.append({"node": "dyn_ball", "shape": "ball", "group": "ball", "mass": 3.0, "radius": 0.55})
zones.append({"id": "bowling", "kind": "bowling", "pos": t3(bowl_dir * (lane_start - 2.2)), "radius": 2.2})  # behind the ball

# ---------------------------------------------------------------- crate stack (south-east, visible from spawn)

CRATE = mat("crate", "#c98b4b", 0.8)
CRATE_EDGE = mat("crate_edge", "#8a5a2b", 0.8)
crate_base = polar(22.5, -22, 0)
k = 0
for level, count in enumerate((3, 2, 1)):
    for j in range(count):
        off = Vector((0.55 * level + j * 1.1 - 1.1, 0, 0))
        c = Vector((crate_base.x + off.x, crate_base.y + off.y, GROUND + 0.5 + level * 1.0))
        parts = [box((1.0, 1.0, 1.0), c, CRATE, bevel=0.03)]
        for dz in (-0.42, 0.42):
            parts.append(box((1.04, 1.04, 0.12), (c.x, c.y, c.z + dz), CRATE_EDGE))
        parts.append(box((1.04, 0.14, 1.04), (c.x, c.y, c.z), CRATE_EDGE, rot=(math.radians(45), 0, 0)))
        join_as(parts, f"dyn_crate_{k}")
        dynamic.append({"node": f"dyn_crate_{k}", "shape": "box", "group": "crate", "mass": 0.5, "half": [0.52, 0.52, 0.52]})
        k += 1
clear(crate_base.x, crate_base.y, 4)

# ---------------------------------------------------------------- brick wall (south-west)

BRICK_R = mat("brick_red", "#b8452e", 0.85)
wall_c = polar(22, 215, 0)
wall_rot = math.radians(215 + 90)
wall_dir = Vector((math.cos(wall_rot), math.sin(wall_rot), 0))
k = 0
for row in range(5):
    n = 6 if row % 2 == 0 else 5
    for j in range(n):
        off = (j - (n - 1) / 2) * 0.92
        p = wall_c + wall_dir * off
        b = box((0.9, 0.44, 0.44), (p.x, p.y, GROUND + 0.22 + row * 0.45), BRICK_R, rot_z=wall_rot, bevel=0.02)
        b.name = f"dyn_brick_{k}"
        dynamic.append({"node": b.name, "shape": "box", "group": "brick", "mass": 0.3, "half": [0.45, 0.22, 0.22]})
        k += 1
floor_text("SMASH IT", wall_c + Vector((math.cos(math.radians(215)), math.sin(math.radians(215)), 0)) * -3.2, WHITE, 0.8)
clear(wall_c.x, wall_c.y, 4.5)

# ---------------------------------------------------------------- race circuit on the ring road

CHECKER_A = mat("checker_a", "#15161b", 0.6)
FINISH_DEG = -135  # arch spans the road side-on to the game camera
checkpoints = [FINISH_DEG, -45, 45, 135]  # counter-clockwise
for i, deg in enumerate(checkpoints):
    zones.append({"id": f"cp:{i}", "kind": "checkpoint", "pos": t3(polar(ROAD_MID, deg)), "radius": 3.2})
fr = math.radians(FINISH_DEG)
for s in range(8):  # checkered finish line across the road
    for t in range(2):
        rr = ROAD_IN + 0.2 + s * (ROAD_OUT - ROAD_IN - 0.4) / 8 + 0.2
        a = fr + (t - 0.5) * 0.028
        m = CHECKER_A if (s + t) % 2 == 0 else WHITE
        box((0.42, 0.42, 0.02), (math.cos(a) * rr, math.sin(a) * rr, GROUND + 0.035), m, rot_z=fr)
for rr in (ROAD_IN - 0.7, ROAD_OUT + 0.7):  # start arch
    cyl(0.18, 4.6, (math.cos(fr) * rr, math.sin(fr) * rr, GROUND + 2.3), WHITE, verts=10)
    static_cyl(Vector((math.cos(fr) * rr, math.sin(fr) * rr, GROUND + 2.3)), 0.25, 4.6)
banner_mid = polar(ROAD_MID, FINISH_DEG, GROUND + 4.4)
box((ROAD_OUT - ROAD_IN + 1.8, 0.2, 0.9), banner_mid, CHECKER_A, rot_z=fr, bevel=0.05)
text_mesh("LAP", (banner_mid.x + math.cos(fr - math.pi / 2) * 0.12, banner_mid.y + math.sin(fr - math.pi / 2) * 0.12,
                  banner_mid.z - 0.35), ORANGE_GLOW, size=0.6, extrude=0.03, rot=(math.radians(90), 0, fr + 0))

# ---------------------------------------------------------------- hidden golden eggs

GOLD = mat("gold", "#ffcf4a", 0.18, 1.0, emit=0.6)
egg_spots = [Vector((-2.5, ZONE_R + 6.2, 0)), Vector((LX - 4.5, LY - 2.5, 0)), Vector((HX + 6.2, -5.4, 0))]
for i, e in enumerate(egg_spots):
    o = ico(0.3, (e.x, e.y, GROUND + 0.8), GOLD, sub=3, scale=(1, 1, 1.3))
    for p in o.data.polygons:
        p.use_smooth = True
    o.name = f"egg_{i}"
    animated.append(o.name)
    zones.append({"id": f"egg:{i}", "kind": "egg", "pos": t3((e.x, e.y, GROUND)), "radius": 1.6})
    clear(e.x, e.y, 1.5)

# ---------------------------------------------------------------- clouds

CLOUD = mat("cloud", "#ffffff", 0.9)
for i in range(7):
    a = random.uniform(0, math.tau)
    r = random.uniform(10, 45)
    c = Vector((math.cos(a) * r, math.sin(a) * r, random.uniform(16, 22)))
    puffs = []
    for j in range(random.randint(3, 5)):
        off = Vector((random.uniform(-2.4, 2.4), random.uniform(-1.2, 1.2), random.uniform(-0.3, 0.5)))
        puffs.append(ico(random.uniform(1.1, 1.9), c + off, CLOUD, sub=1, scale=(1, 1, 0.7)))
    join_as(puffs, f"cloud_{i}")
    animated.append(f"cloud_{i}")

# ---------------------------------------------------------------- trees and rocks


def blocked(p):
    for cx, cy, cr in clearings:
        if (p.x - cx) ** 2 + (p.y - cy) ** 2 < cr * cr:
            return True
    r = p.length
    ang = math.degrees(math.atan2(p.y, p.x)) % 360
    if ROAD_IN - 2.2 < r < ROAD_OUT + 2.0 or r < 7.5 or r > ISLAND_R - 3:
        return True
    view_deg = math.degrees(math.atan2(VIEW.y, VIEW.x)) % 360
    from_view = min(abs(ang - view_deg), 360 - abs(ang - view_deg))
    if r < ROAD_IN and from_view < 110:
        return True  # keep the line of sight from the camera to the name clear
    for deg in (0, 90, 180, 270):
        dd = min(abs(ang - deg), 360 - abs(ang - deg))
        if r > ROAD_OUT and dd < 26:
            return True
        if dd * math.pi / 180 * r < 3.2:
            return True
    for q in (Vector((LX, LY, 0)), polar(ROAD_OUT + 1.6, -48, 0), spawn * 1):
        if (p - Vector((q.x, q.y, 0))).length < 4:
            return True
    return False


leafs = [LEAF_A, LEAF_B, LEAF_C]
placed = tries = 0
while placed < 95 and tries < 6000:
    tries += 1
    r = random.uniform(8, ISLAND_R - 3)
    a = random.uniform(0, math.tau)
    p = Vector((math.cos(a) * r, math.sin(a) * r, 0))
    if blocked(p):
        continue
    placed += 1
    s = random.uniform(0.75, 1.4)
    if random.random() < 0.82:
        cyl(0.24 * s, 1.3 * s, (p.x, p.y, GROUND + 0.65 * s), TRUNK, verts=6)
        g = random.choice(leafs)
        cyl(1.4 * s, 1.9 * s, (p.x, p.y, GROUND + 2.05 * s), g, verts=7, r2=0.55 * s)
        cyl(1.0 * s, 1.6 * s, (p.x, p.y, GROUND + 3.2 * s), g, verts=7, r2=0.0)
        static_cyl(Vector((p.x, p.y, GROUND + 1.5)), 0.35 * s, 3)
    else:
        ico(0.9 * s, (p.x, p.y, GROUND + 0.3 * s), ROCK, sub=1,
            scale=(1, random.uniform(0.7, 1.2), random.uniform(0.5, 0.8)))
        static_cyl(Vector((p.x, p.y, GROUND + 0.5)), 0.8 * s, 1)

def shore_radii(n=64, radius=ISLAND_R + 4, wobble=0.08, seed=3.0):
    """Sand outline radius at n evenly spaced three.js angles (theta = atan2(z, x) = -blender angle)."""
    out = []
    for i in range(n):
        a = -i / n * math.tau
        k = 1 + wobble * noise.noise(Vector((math.cos(a) * 1.4 + seed, math.sin(a) * 1.4, seed)))
        out.append(round(radius * k, 3))
    return out


# ---------------------------------------------------------------- export world

keep = set(animated) | {d["node"] for d in dynamic} | {"col_grass", "col_sand"}
keep_roots = set()
for name in keep:
    o = bpy.data.objects.get(name)
    if o:
        keep_roots.add(o)
        keep_roots.update(o.children_recursive)

statics = [o for o in bpy.data.objects if o.type == "MESH" and o not in keep_roots]
for o in bpy.data.objects:
    if o.type == "MESH":
        apply_all_modifiers(o)
bpy.ops.object.select_all(action="DESELECT")
for o in statics:
    o.select_set(True)
bpy.context.view_layer.objects.active = statics[0]
bpy.ops.object.join()
scenery = bpy.context.active_object
scenery.name = "scenery"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=str(OUT / "world.glb"), export_format="GLB", use_selection=True,
                          export_yup=True, export_apply=True, export_texcoords=False)

meta = {
    "ground": GROUND,
    "islandRadius": ISLAND_R,
    "spawn": {"pos": t3(spawn), "rotY": round(spawn_heading, 4)},
    "colliders": colliders,
    "dynamic": dynamic,
    "zones": zones,
    "animated": animated,
    "roads": {"ringIn": ROAD_IN, "ringOut": ROAD_OUT, "plaza": 6.5, "spokeHalf": 1.7, "spokes": [0, 90, 180, 270]},
    "clearings": [[round(x, 3), round(-y, 3), r] for x, y, r in clearings],
    "shore": shore_radii(),
}
(OUT / "world.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
print(f"[world] {len(colliders)} colliders, {len(dynamic)} dynamic props, {len(zones)} zones")

# ---------------------------------------------------------------- the car (separate file)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
body_parts = [
    box((2.5, 1.35, 0.5), (0, 0, 0.1), ORANGE, bevel=0.14),
    box((1.35, 1.15, 0.52), (-0.25, 0, 0.6), mat("car_glass", "#1b2a3a", 0.08, 0.3), bevel=0.12),
    box((1.4, 1.2, 0.08), (-0.25, 0, 0.88), ORANGE, bevel=0.03),
    box((0.3, 1.45, 0.08), (-1.28, 0, 0.62), DARK, bevel=0.02),
    box((0.1, 0.1, 0.3), (-1.2, 0.45, 0.45), DARK),
    box((0.1, 0.1, 0.3), (-1.2, -0.45, 0.45), DARK),
    box((0.06, 0.3, 0.14), (1.26, 0.42, 0.18), WARM_GLOW),
    box((0.06, 0.3, 0.14), (1.26, -0.42, 0.18), WARM_GLOW),
    box((0.06, 0.32, 0.1), (-1.26, 0.42, 0.2), RED_GLOW),
    box((0.06, 0.32, 0.1), (-1.26, -0.42, 0.2), RED_GLOW),
    box((0.5, 1.39, 0.12), (1.0, 0, -0.1), DARK, bevel=0.03),
]
bpy.ops.object.select_all(action="DESELECT")
for o in body_parts:
    apply_all_modifiers(o)
    o.select_set(True)
bpy.context.view_layer.objects.active = body_parts[0]
bpy.ops.object.join()
body = bpy.context.active_object
body.name = "body"

tire = cyl(0.36, 0.3, (0, 0, 0), DARK, rot=(math.radians(90), 0, 0), verts=20, smooth=True)
hub = cyl(0.19, 0.32, (0, 0, 0), METAL, rot=(math.radians(90), 0, 0), verts=10)
bpy.ops.object.select_all(action="DESELECT")
tire.select_set(True)
hub.select_set(True)
bpy.context.view_layer.objects.active = tire
bpy.ops.object.join()
tire.name = "wheel"
tire.location = (0, -4, 0)  # out of the way; three.js places four copies

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=str(OUT / "car.glb"), export_format="GLB", use_selection=True, export_yup=True,
                          export_apply=True)
print("[world] wrote car.glb")
