"""Builds the drivable island, exports it for the web.

Outputs (in <out_dir>):
  world.glb   static scenery (joined by material) + named dynamic props + animated props
  car.glb     chassis ("body") and one wheel ("wheel"), forward = +X
  world.json  physics colliders, dynamic prop shapes, interaction zones, spawn point

Blender is Z-up; everything written to world.json is already converted to three.js Y-up:
  three(x, y, z) = blender(x, z, -y), and a Blender rotation about Z equals a three rotation about Y.

Run: blender --background --factory-startup --python scripts/blender/build_world.py -- <out_dir>
"""

import json
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Vector, noise

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["public/world"]
OUT = Path(args[-1])
OUT.mkdir(parents=True, exist_ok=True)
FONT = Path("C:/Windows/Fonts/ariblk.ttf")

GROUND = 0.5  # top of the grass
ISLAND_R = 72.0  # big island: room for the city district, ramps and traffic
ROAD_IN, ROAD_OUT = 17.0, 20.4
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
SCREEN_TEXT = mat("screen_text", "#eaf6ff", 0.4, emit=1.6)


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

ZONE_R = 33.5
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
    dynamic.append({"node": c.name, "shape": "box", "group": "cone", "mass": 0.25, "half": [0.35, 0.45, 0.35]})

spawn = polar(ROAD_MID, -60)
spawn_heading = math.radians(-60 + 90)

# ---------------------------------------------------------------- EAST: project boards

# One source of truth: the same JSON the website renders.
ROOT = Path(__file__).resolve().parents[2]
PROJECTS = json.loads((ROOT / "src" / "projects.json").read_text(encoding="utf-8"))
SKILLS = json.loads((ROOT / "src" / "skills.json").read_text(encoding="utf-8"))

HX = ZONE_R + 3
PX, PY = ZONE_R + 2.0, 0.0  # center of the project plaza
ROW = Vector((-VIEW.y, VIEW.x, 0))  # boards stand in a row across the camera's view…
FACE_VIEW = math.atan2(VIEW.y, VIEW.x) + math.pi / 2  # …and face it, so every board reads head-on
PB_W, PB_H, PB_Z = 3.9, 2.5, GROUND + 2.45
SPACING = 4.4
board_centers = []

plaza = box((SPACING * len(PROJECTS) + 2.5, 9.0, 0.1), (PX + VIEW.x * 1.2, PY + VIEW.y * 1.2, GROUND + 0.05),
            mat("plaza_floor", "#2c2f38", 0.45), rot_z=FACE_VIEW)
MUTED_TEXT = mat("muted_text", "#9fb3c8", 0.5, emit=1.0)
for i, p in enumerate(PROJECTS):
    c = Vector((PX, PY, 0)) + ROW * ((i - (len(PROJECTS) - 1) / 2) * SPACING)
    board_centers.append((p["slug"], c))
    accent = mat(f"proj_{p['slug']}", p["color"], 0.4, emit=3)
    front = VIEW * 0.14
    for s in (-1, 1):
        post = c + ROW * (s * (PB_W / 2 - 0.3))
        cyl(0.09, PB_Z - GROUND, (post.x, post.y, GROUND + (PB_Z - GROUND) / 2), METAL, verts=10)
        static_cyl(Vector((post.x, post.y, GROUND + 1)), 0.18, 2)
    box((PB_W, 0.22, PB_H), (c.x, c.y, PB_Z), DARK, rot_z=FACE_VIEW, bevel=0.08)
    box((PB_W - 0.26, 0.06, PB_H - 0.26), (c.x + VIEW.x * 0.1, c.y + VIEW.y * 0.1, PB_Z), SCREEN, rot_z=FACE_VIEW)
    bar = c + front
    box((PB_W - 0.26, 0.04, 0.14), (bar.x, bar.y, PB_Z + PB_H / 2 - 0.2), accent, rot_z=FACE_VIEW)
    t = c + front
    rot = (math.radians(90), 0, FACE_VIEW)
    number = t - ROW * (PB_W / 2 - 0.55)
    text_mesh(f"0{i + 1}", (number.x, number.y, PB_Z + 0.62), accent, size=0.26, extrude=0.02, rot=rot)
    text_mesh(p["title"], (t.x, t.y, PB_Z + 0.2), accent, size=0.44 if len(p["title"]) < 12 else 0.34,
              extrude=0.03, rot=rot)
    text_mesh(p["tagline"], (t.x, t.y, PB_Z - 0.25), SCREEN_TEXT, size=0.2, extrude=0.02, rot=rot)
    text_mesh("  ·  ".join(p["tech"][:3]), (t.x, t.y, PB_Z - 0.75), MUTED_TEXT, size=0.15, extrude=0.015, rot=rot)
    pad_at = c + VIEW * 3.2
    pad = cyl(1.15, 0.03, (pad_at.x, pad_at.y, GROUND + 0.11), PAD, verts=40)
    pad.name = f"pad_{p['slug']}"
    animated.append(pad.name)
    zones.append({"id": f"project:{p['slug']}", "kind": "project", "slug": p["slug"], "pos": t3((pad_at.x, pad_at.y, GROUND)),
                  "radius": 1.4})

sign_at = Vector((PX, PY, 0)) - VIEW * 1.6
text_mesh("PROJECTS", (sign_at.x, sign_at.y, GROUND + 4.6), ORANGE_GLOW, size=1.2, extrude=0.16,
          rot=(math.radians(90), 0, FACE_VIEW))
floor_text("PROJECTS", Vector((ZONE_R - 9.5, -3.0, 0)), WHITE, 1.4)
PX_BEHIND = Vector((PX, PY, 0)) - VIEW * 3.5  # a golden egg hides here

# ---------------------------------------------------------------- WEST: skills scoreboard + blocks

SKILL_GROUPS = [(g["group"].upper(), g["color"], g["items"]) for g in SKILLS]  # from src/skills.json
FACE_X = (math.radians(90), 0, math.radians(90))  # text standing up, readable from +X

BX = -(ZONE_R + 2)
BOARD_W, BOARD_H, BOARD_Z = 15.0, 6.6, GROUND + 6.3
for y in (-6.2, 6.2):
    cyl(0.22, BOARD_Z - GROUND, (BX, y, GROUND + (BOARD_Z - GROUND) / 2), METAL, verts=10)
    static_cyl(Vector((BX, y, GROUND + 2)), 0.32, 4)
box((0.4, BOARD_W, BOARD_H), (BX, 0, BOARD_Z), DARK, bevel=0.12)
box((0.1, BOARD_W - 0.7, BOARD_H - 0.6), (BX + 0.22, 0, BOARD_Z), SCREEN)
text_mesh("SKILLS", (BX + 0.3, 0, BOARD_Z + 2.05), CYAN_GLOW, size=0.95, extrude=0.05, rot=FACE_X)
col_w = (BOARD_W - 1.0) / len(SKILL_GROUPS)
for i, (title, color, items) in enumerate(SKILL_GROUPS):
    cy = -(BOARD_W - 1.0) / 2 + col_w * (i + 0.5)
    accent = mat(f"skill_{i}", color, 0.4, emit=3)
    text_mesh(title, (BX + 0.3, cy, BOARD_Z + 1.25), accent, size=0.34, extrude=0.03, rot=FACE_X)
    box((0.05, col_w - 0.6, 0.06), (BX + 0.29, cy, BOARD_Z + 1.12), accent)
    for n, item in enumerate(items):
        text_mesh(item, (BX + 0.3, cy, BOARD_Z + 0.55 - n * 0.52), SCREEN_TEXT, size=0.27, extrude=0.02, rot=FACE_X)
floor_text("SKILLS", Vector((-(ZONE_R - 6.5), 2.5, 0)), WHITE, 1.4)
zones.append({"id": "skills", "kind": "skills", "pos": t3((BX + 4.5, 0, GROUND)), "radius": 2.6})
pad = cyl(2.2, 0.03, (BX + 4.5, 0, GROUND + 0.075), PAD, verts=48)
pad.name = "pad_skills"
animated.append(pad.name)

# A pyramid of skill blocks to smash, colored by category, labeled on the two faces the camera sees.
blocks = [("TS", 0), ("PY", 0), ("C", 0), ("RS", 0), ("JS", 1), ("3D", 1), ("SOL", 2), ("ML", 3), ("RAG", 3), ("OS", 4)]
k = 0
for level, count in enumerate((4, 3, 2, 1)):
    for j in range(count):
        label_text, group = blocks[k]
        x = BX + 8.5
        y = -2.1 + j * 1.25 + level * 0.625 - 6.5
        z = GROUND + 0.6 + level * 1.21
        b = box((1.2, 1.2, 1.2), (x, y, z), mat(f"blk_{group}", SKILL_GROUPS[group][1], 0.5), bevel=0.08)
        size = 0.5 if len(label_text) < 3 else 0.36
        labels = [
            text_mesh(label_text, (x + 0.6, y, z - size * 0.45), WHITE, size=size, extrude=0.02, rot=FACE_X),
            text_mesh(label_text, (x, y - 0.6, z - size * 0.45), WHITE, size=size, extrude=0.02, rot=(math.radians(90), 0, 0)),
        ]
        bpy.ops.object.select_all(action="DESELECT")
        for o in [b] + labels:
            o.select_set(True)
        bpy.context.view_layer.objects.active = b
        bpy.ops.object.join()
        b.name = f"dyn_block_{k}"  # origin stays at the cube center, matching the collider
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

LX, LY = -32, -30
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
clear(PX, PY, SPACING * len(PROJECTS) / 2 + 1.5)
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
lane_start, lane_end = ROAD_OUT + 5.5, ROAD_OUT + 19.0
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
crate_base = polar(28.5, -22, 0)
k = 0
for level, count in enumerate((3, 2, 1)):
    for j in range(count):
        off = Vector((0.55 * level + j * 1.1 - 1.1, 0, 0))
        c = Vector((crate_base.x + off.x, crate_base.y + off.y, GROUND + 0.505 + level * 1.01))  # colliders must not overlap
        parts = [box((1.0, 1.0, 1.0), c, CRATE, bevel=0.03)]
        for dz in (-0.42, 0.42):
            parts.append(box((1.04, 1.04, 0.12), (c.x, c.y, c.z + dz), CRATE_EDGE))
        parts.append(box((1.04, 0.14, 1.04), (c.x, c.y, c.z), CRATE_EDGE, rot=(math.radians(45), 0, 0)))
        join_as(parts, f"dyn_crate_{k}")
        dynamic.append({"node": f"dyn_crate_{k}", "shape": "box", "group": "crate", "mass": 0.5, "half": [0.52, 0.5, 0.52]})
        k += 1
clear(crate_base.x, crate_base.y, 4)

# ---------------------------------------------------------------- brick wall (south-west)

BRICK_R = mat("brick_red", "#b8452e", 0.85)
wall_c = polar(28, 215, 0)
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
egg_spots = [Vector((-2.5, ZONE_R + 6.2, 0)), Vector((LX + 4.0, LY - 3.0, 0)), PX_BEHIND]  # the third hides behind the project boards
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

# ---------------------------------------------------------------- city district (north-west)
# A small grid town: streets, sidewalks, buildings (fade out in-game when they hide the car),
# street lamps, a traffic light, parked cars to smash. The grid is rotated to face the island center.

TOWN_DEG = 135
TOWN_C = polar(48, TOWN_DEG, 0)
T_FWD = Vector((math.cos(math.radians(TOWN_DEG)), math.sin(math.radians(TOWN_DEG)), 0))  # outward
T_SIDE = Vector((-T_FWD.y, T_FWD.x, 0))
T_ROT = math.radians(TOWN_DEG)
BLOCK, STREET = 8.0, 5.0
N_BLOCKS = 2
SPAN = N_BLOCKS * BLOCK + (N_BLOCKS + 1) * STREET  # 31 m square
SIDEWALK = mat("sidewalk", "#c9c4ba", 0.9)
WINDOWS = mat("windows", "#ffe9a8", 0.3, emit=0.35)  # three.js turns these up at night
FACADES = ["#e8dccb", "#c9d6e3", "#f1c9b5", "#d7e6c8", "#e6d3ef", "#f4e3b1", "#b9c7cf"]


def town(u, v, z=GROUND):
    """Town-local (u along the outward axis, v across) to world."""
    p = TOWN_C + T_FWD * u + T_SIDE * v
    return Vector((p.x, p.y, z))


# connecting avenue from the inner ring to the town
near = ROAD_OUT - 0.2
far = 48 - SPAN / 2 + 0.1
mid = polar((near + far) / 2, TOWN_DEG, GROUND + 0.012)
box((far - near, STREET, 0.03), mid, ROAD, rot_z=T_ROT)

# street grid (lines at u, v = -SPAN/2 + STREET/2 + k * (BLOCK + STREET))
lines = [-SPAN / 2 + STREET / 2 + k * (BLOCK + STREET) for k in range(N_BLOCKS + 1)]
for L in lines:
    c = town(L, 0, GROUND + 0.013)
    box((STREET, SPAN, 0.03), c, ROAD, rot_z=T_ROT)
    c = town(0, L, GROUND + 0.014)
    box((SPAN, STREET, 0.03), c, ROAD, rot_z=T_ROT)
    for k in range(-6, 7):  # dashed center lines
        d = town(L, k * 2.3, GROUND + 0.03)
        box((0.12, 1.1, 0.01), d, PAINT, rot_z=T_ROT)
        d = town(k * 2.3, L, GROUND + 0.031)
        box((1.1, 0.12, 0.01), d, PAINT, rot_z=T_ROT)

random.seed(17)
b_index = 0
lamp_spots = []
for bi in range(N_BLOCKS):
    for bj in range(N_BLOCKS):
        bu = -SPAN / 2 + STREET + BLOCK / 2 + bi * (BLOCK + STREET)
        bv = -SPAN / 2 + STREET + BLOCK / 2 + bj * (BLOCK + STREET)
        box((BLOCK, BLOCK, 0.18), town(bu, bv, GROUND + 0.09), SIDEWALK, rot_z=T_ROT, bevel=0.04)
        lamp_spots += [(bu - BLOCK / 2 + 0.4, bv - BLOCK / 2 + 0.4), (bu + BLOCK / 2 - 0.4, bv + BLOCK / 2 - 0.4)]
        for qi in (-1, 1):
            for qj in (-1, 1):
                w, d = random.uniform(2.6, 3.3), random.uniform(2.6, 3.3)
                h = random.choice([3.2, 4.5, 6.0, 7.5, 9.5])
                cu, cv = bu + qi * 1.85, bv + qj * 1.85
                base = town(cu, cv, GROUND + 0.18)
                facade = mat(f"facade_{b_index % len(FACADES)}", FACADES[b_index % len(FACADES)], 0.8)
                parts = [box((w, d, h), (base.x, base.y, base.z + h / 2), facade, rot_z=T_ROT, bevel=0.05)]
                floors = max(1, int((h - 0.8) / 1.5))
                for f in range(floors):  # window bands on all four sides
                    z = base.z + 1.1 + f * 1.5
                    parts.append(box((w + 0.04, d * 0.8, 0.45), (base.x, base.y, z), WINDOWS, rot_z=T_ROT))
                    parts.append(box((w * 0.8, d + 0.04, 0.45), (base.x, base.y, z), WINDOWS, rot_z=T_ROT))
                roof_c = town(cu + random.uniform(-0.5, 0.5), cv + random.uniform(-0.5, 0.5), base.z + h)
                parts.append(box((1.0, 0.8, 0.5), (roof_c.x, roof_c.y, roof_c.z + 0.25), METAL, rot_z=T_ROT))
                bld = join_as(parts, f"bldg_{b_index}")
                animated.append(bld.name)
                static_box(Vector((base.x, base.y, base.z + h / 2)), (w, d, h), T_ROT)
                b_index += 1
        static_box(town(bu, bv, GROUND + 0.09), (BLOCK, BLOCK, 0.18), T_ROT)  # curb you can bump

LAMP_HEAD = mat("lamp_head", "#fff2c4", 0.3, emit=2.0)
for u, v in lamp_spots:
    p = town(u, v, GROUND)
    cyl(0.06, 3.4, (p.x, p.y, GROUND + 1.9), DARK, verts=8)
    ico(0.18, (p.x, p.y, GROUND + 3.65), LAMP_HEAD, sub=2)
    static_cyl(Vector((p.x, p.y, GROUND + 1)), 0.12, 2)

# a traffic light at the central intersection (lamps animated in three.js)
tl = town(lines[1] + STREET / 2 + 0.4, lines[1] + STREET / 2 + 0.4)
cyl(0.08, 3.6, (tl.x, tl.y, GROUND + 1.8), DARK, verts=8)
box((0.35, 0.35, 1.0), (tl.x, tl.y, GROUND + 3.9), DARK, rot_z=T_ROT, bevel=0.04)
for k, (name, col) in enumerate((("tl_red", "#ff3b30"), ("tl_amber", "#ffb020"), ("tl_green", "#34c759"))):
    lamp = ico(0.11, (tl.x + VIEW.x * 0.19, tl.y + VIEW.y * 0.19, GROUND + 4.2 - k * 0.3), mat(name, col, 0.3, emit=0.2), sub=2)
    lamp.name = name
    animated.append(name)
static_cyl(Vector((tl.x, tl.y, GROUND + 1)), 0.15, 2)

# parked cars along the streets — dynamic, so they can be shunted
CAR_COLS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#e5e7eb", "#6366f1"]
for k in range(6):
    L = lines[k % len(lines)]
    along = random.uniform(-SPAN / 2 + 4, SPAN / 2 - 4)
    u, v, yaw = (L - 1.6, along, T_ROT + math.pi / 2) if k % 2 else (along, L + 1.6, T_ROT)
    p = town(u, v, GROUND + 0.55)
    body_c = mat(f"parked_{k}", CAR_COLS[k], 0.4)
    parts = [box((2.2, 1.1, 0.55), (p.x, p.y, p.z), body_c, rot_z=yaw, bevel=0.1),
             box((1.2, 0.95, 0.45), (p.x, p.y, p.z + 0.48), mat("car_glass", "#1b2a3a", 0.08, 0.3), rot_z=yaw, bevel=0.08)]
    for sx in (-0.7, 0.7):
        for sy in (-0.55, 0.55):
            off = Vector((math.cos(yaw) * sx - math.sin(yaw) * sy, math.sin(yaw) * sx + math.cos(yaw) * sy, 0))
            parts.append(cyl(0.28, 0.2, (p.x + off.x, p.y + off.y, p.z - 0.28), DARK, rot=(math.radians(90), 0, yaw), verts=12))
    car_obj = join_as(parts, f"dyn_parked_{k}")
    dynamic.append({"node": car_obj.name, "shape": "box", "group": "parked", "mass": 3.0, "half": [1.1, 0.63, 0.56]})

floor_text("DOWNTOWN", town(-SPAN / 2 - 3.2, 0), WHITE, 1.3)
clear(TOWN_C.x, TOWN_C.y, SPAN * 0.75)
clear(mid.x, mid.y, (far - near) / 2 + 1)

# ---------------------------------------------------------------- stunt ramps


def ramp(center, heading_deg, length=7.0, width=4.0, height=1.7):
    """A wedge you drive up along `heading_deg`. Collider is an inclined box matching the top surface."""
    a = math.radians(heading_deg)
    slope = math.atan2(height, length)
    bm = bmesh.new()
    hl, hw = length / 2, width / 2
    v = [bm.verts.new(p) for p in ((-hl, -hw, 0), (hl, -hw, 0), (hl, hw, 0), (-hl, hw, 0), (hl, -hw, height), (hl, hw, height))]
    for f in ((0, 3, 2, 1), (0, 1, 4), (3, 5, 2), (1, 2, 5, 4), (0, 4, 5, 3)):
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new("ramp")
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("ramp", me)
    bpy.context.collection.objects.link(o)
    o.location = (center.x, center.y, GROUND)
    o.rotation_euler = (0, 0, a)
    finish(o, mat("ramp", "#f5b83d", 0.6))
    for s in (-1, 1):  # warning stripes on the sides
        stripe_at = Vector((center.x, center.y, 0)) + Vector((-math.sin(a), math.cos(a), 0)) * (s * (hw + 0.01))
        box((length * 0.9, 0.02, 0.18), (stripe_at.x, stripe_at.y, GROUND + height * 0.3), DARK, rot_z=a)
    # inclined collider slab: its top face is the ramp surface
    thick = 0.4
    slab_len = math.hypot(length, height)
    n = Vector((-math.sin(slope) * math.cos(a), -math.sin(slope) * math.sin(a), math.cos(slope)))
    top_mid = Vector((center.x, center.y, GROUND + height / 2))
    c = top_mid - n * (thick / 2)
    q = Euler((0, -slope, a), "XYZ").to_quaternion()  # pitch up, then yaw
    colliders.append({"shape": "box", "pos": t3(c), "half": [slab_len / 2, thick / 2, width / 2],
                      "quat": [round(q.x, 5), round(q.z, 5), round(-q.y, 5), round(q.w, 5)]})
    clear(center.x, center.y, length * 0.6)


ramp(polar(46, -8, 0), -8 + 90)
ramp(polar(44, 250, 0), 250 - 90)
ramp(polar(56, 60, 0), 60 + 180)

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
while placed < 170 and tries < 9000:
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

# Record where each prop starts (three.js space), so physics can be tested without the GLB.
for d in dynamic:
    o = bpy.data.objects.get(d["node"])
    if o:
        loc, q, _ = o.matrix_world.decompose()
        d["pos"] = t3(loc)
        d["quat"] = [round(q.x, 5), round(q.z, 5), round(-q.y, 5), round(q.w, 5)]

meta = {
    "ground": GROUND,
    "islandRadius": ISLAND_R,
    "spawn": {"pos": t3(spawn), "rotY": round(spawn_heading, 4)},
    "colliders": colliders,
    "dynamic": dynamic,
    "zones": zones,
    "animated": animated,
    "roads": {"ringIn": ROAD_IN, "ringOut": ROAD_OUT, "plaza": 6.5, "spokeHalf": 1.7, "spokes": [0, 90, 180, 270, TOWN_DEG]},
    "town": {"center": t3(TOWN_C), "span": SPAN, "rotY": round(T_ROT, 4)},
    "clearings": [[round(x, 3), round(-y, 3), r] for x, y, r in clearings],
    "shore": shore_radii(),
}
(OUT / "world.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
print(f"[world] {len(colliders)} colliders, {len(dynamic)} dynamic props, {len(zones)} zones")

# ---------------------------------------------------------------- the car (separate file)
# Frame: +X forward, Z up. The physics chassis in Car.tsx is a 2.5 x 0.6 x 1.36 box centered 0.12 above the origin.
# The world stays loaded for the hero renders below; everything but the car is removed before export.

GLASS = mat("car_glass", "#1b2a3a", 0.08, 0.3)
CHROME = mat("chrome", "#e8ebf0", 0.15, 1.0)


def prism(name, bottom, top, z0, z1, m):
    """Box whose top face is a different rectangle: (x0, x1, half_y) each. Gives a sloped windshield."""
    bm = bmesh.new()
    vs = []
    for (x0, x1, hy), z in ((bottom, z0), (top, z1)):
        vs.append([bm.verts.new(p) for p in ((x0, -hy, z), (x1, -hy, z), (x1, hy, z), (x0, hy, z))])
    b, t = vs
    bm.faces.new(list(reversed(b)))
    bm.faces.new(t)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((b[i], b[j], t[j], t[i]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    bev = o.modifiers.new("bevel", "BEVEL")
    bev.width, bev.segments = 0.05, 2
    return finish(o, m)


body_parts = [
    box((2.5, 1.3, 0.46), (0, 0, 0.1), ORANGE, bevel=0.16),
    prism("cabin", (-0.95, 0.42, 0.57), (-0.82, 0.02, 0.5), 0.33, 0.86, GLASS),
    box((0.96, 1.06, 0.07), (-0.4, 0, 0.9), ORANGE, bevel=0.03),
    # racing stripe down both sides
    box((2.1, 0.012, 0.07), (0, 0.652, 0.2), WHITE),
    box((2.1, 0.012, 0.07), (0, -0.652, 0.2), WHITE),
    # bumpers + grille
    box((0.16, 1.36, 0.15), (1.28, 0, -0.04), DARK, bevel=0.04),
    box((0.16, 1.36, 0.15), (-1.28, 0, -0.04), DARK, bevel=0.04),
    box((0.03, 0.5, 0.15), (1.262, 0, 0.19), DARK),
    # rear wing
    box((0.3, 1.45, 0.07), (-1.24, 0, 0.66), DARK, bevel=0.02),
    box((0.08, 0.08, 0.32), (-1.18, 0.42, 0.47), DARK),
    box((0.08, 0.08, 0.32), (-1.18, -0.42, 0.47), DARK),
    # tail lights + license plate
    box((0.04, 0.3, 0.09), (-1.262, 0.42, 0.2), RED_GLOW),
    box((0.04, 0.3, 0.09), (-1.262, -0.42, 0.2), RED_GLOW),
    box((0.02, 0.42, 0.14), (-1.268, 0, 0.1), WHITE),
    text_mesh("AY 08", (-1.285, 0, 0.055), DARK, size=0.1, extrude=0.005, rot=(math.radians(90), 0, math.radians(-90))),
    cyl(0.045, 0.2, (-1.3, -0.3, -0.08), CHROME, rot=(0, math.radians(90), 0), verts=10),  # exhaust
]
for y in (-0.45, 0.45):  # round headlights in chrome rings
    body_parts.append(cyl(0.12, 0.05, (1.25, y, 0.19), CHROME, rot=(0, math.radians(90), 0), verts=18, smooth=True))
    body_parts.append(cyl(0.095, 0.06, (1.26, y, 0.19), WARM_GLOW, rot=(0, math.radians(90), 0), verts=18, smooth=True))
for x in (-0.8, 0.8):  # fender flares over each wheel
    for y in (-0.66, 0.66):
        body_parts.append(box((0.86, 0.14, 0.08), (x, y * 1.05, 0.16), DARK, bevel=0.035))
bpy.ops.object.select_all(action="DESELECT")
for o in body_parts:
    apply_all_modifiers(o)
    o.select_set(True)
bpy.context.view_layer.objects.active = body_parts[0]  # its origin is the chassis frame origin
bpy.ops.object.join()
body = bpy.context.active_object
body.name = "body"

# Wheel: axle along Blender Y (three.js Z). Radius 0.36 m, width 0.3 m — must match WHEEL_RADIUS in Car.tsx.
RUBBER = mat("rubber", "#1c1d22", 0.85)
RIM = mat("rim", "#d9dde3", 0.25, 1.0)
RIM_DARK = mat("rim_dark", "#7d838e", 0.35, 1.0)
AXLE = (math.radians(90), 0, 0)
parts = []
tire = cyl(0.335, 0.28, (0, 0, 0), RUBBER, rot=AXLE, verts=28, smooth=True)
bev = tire.modifiers.new("bevel", "BEVEL")
bev.width, bev.segments, bev.limit_method = 0.07, 3, "ANGLE"  # rounded sidewalls
parts.append(tire)
for n in range(26):  # staggered tread blocks around the circumference
    phi = n / 26 * math.tau
    for side in (-1, 1):
        off = 0.02 if n % 2 else -0.02
        r = 0.347
        blk = box((0.06, 0.1, 0.026), (math.sin(phi) * r, side * 0.075 + off * side, math.cos(phi) * r), RUBBER,
                  rot=(0, phi, 0), bevel=0.01)
        parts.append(blk)
parts.append(cyl(0.215, 0.31, (0, 0, 0), RIM_DARK, rot=AXLE, verts=24, smooth=True))  # rim barrel
for face in (-1, 1):
    y = face * 0.155
    parts.append(cyl(0.2, 0.02, (0, y, 0), RIM_DARK, rot=AXLE, verts=24, smooth=True))  # recessed rim face
    bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.02, location=(0, y, 0), rotation=AXLE,
                                     major_segments=28, minor_segments=6)
    parts.append(finish(bpy.context.active_object, RIM, flat=False))  # bright rim lip
    for s in range(5):  # spokes
        a = s / 5 * math.tau
        parts.append(box((0.05, 0.03, 0.17), (math.sin(a) * 0.1, y + face * 0.022, math.cos(a) * 0.1), RIM,
                         rot=(0, a, 0), bevel=0.008))
    parts.append(cyl(0.065, 0.03, (0, y + face * 0.02, 0), ORANGE, rot=AXLE, verts=16, smooth=True))  # hubcap
wheel = join_as(parts, "wheel")
wheel.location = (0, -4, 0)  # out of the way; three.js places four copies

# ---------------------------------------------------------------- hero renders (loader backdrop, classic site, link previews)


def render_hero():
    rig = bpy.data.objects.new("hero_car", None)
    bpy.context.collection.objects.link(rig)
    at = polar(ROAD_MID, -28, GROUND + 0.66)
    rig.location = at
    rig.rotation_euler = (0, 0, math.radians(-28 + 90))
    copies = []
    b = body.copy()
    bpy.context.collection.objects.link(b)
    b.parent = rig
    copies.append(b)
    for x in (-0.8, 0.8):
        for y in (-0.64, 0.64):
            w = wheel.copy()
            bpy.context.collection.objects.link(w)
            w.parent = rig
            w.location = (x, y, -0.3)
            copies.append(w)

    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(48), math.radians(8), math.radians(38)))
    sun = bpy.context.active_object
    sun.data.energy, sun.data.angle = 4.2, math.radians(4)
    sun.data.color = (1.0, 0.95, 0.86)
    world = bpy.context.scene.world or bpy.data.worlds.new("w")
    bpy.context.scene.world = world
    try:
        world.use_nodes = True
    except AttributeError:
        pass
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (*srgb("#a8d8f4"), 1)
    bg.inputs["Strength"].default_value = 1.1
    bpy.ops.mesh.primitive_plane_add(size=900, location=(0, 0, -0.35))
    sea = finish(bpy.context.active_object, mat("hero_sea", "#3aa7d6", 0.2))

    s = bpy.context.scene
    for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            s.render.engine = eng
            break
        except TypeError:
            continue
    try:
        s.eevee.taa_render_samples = 48
    except AttributeError:
        pass
    cam = bpy.data.objects.new("hero_cam", bpy.data.cameras.new("hero_cam"))
    bpy.context.collection.objects.link(cam)
    cam.location = (58, -58, 44)  # keep in sync with INTRO_FROM in src/game/Car.tsx
    cam.data.lens = 34
    cam.rotation_euler = (Vector((0, 4, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    s.camera = cam
    shots = [("hero.webp", 1600, 1000, "WEBP"), ("og.jpg", 1200, 630, "JPEG")]
    for name, w_, h_, fmt in shots:
        s.render.resolution_x, s.render.resolution_y = w_, h_
        s.render.image_settings.file_format = fmt
        s.render.image_settings.quality = 82
        s.render.filepath = str((OUT / name).resolve())
        bpy.ops.render.render(write_still=True)
        print(f"[world] rendered {name}")

    # Each project board, head-on: the classic site uses these as its card images.
    thumbs = OUT / "thumbs"
    thumbs.mkdir(exist_ok=True)
    s.render.resolution_x, s.render.resolution_y = 960, 600
    s.render.image_settings.file_format = "WEBP"
    s.render.image_settings.color_mode = "RGB"
    cam.data.lens = 50
    for slug, c in board_centers:
        eye = Vector((c.x, c.y, PB_Z)) + VIEW * 6.2
        cam.location = eye
        cam.rotation_euler = (Vector((c.x, c.y, PB_Z)) - eye).to_track_quat("-Z", "Y").to_euler()
        print(f"[thumb] {slug} center={tuple(round(v, 1) for v in c)} eye={tuple(round(v, 1) for v in eye)}")
        s.render.filepath = str((thumbs / f"{slug}.webp").resolve())
        bpy.ops.render.render(write_still=True)
    print(f"[world] rendered {len(board_centers)} board thumbnails")
    return copies + [rig, sun, sea, cam]


render_hero()

# Keep only the car parts for car.glb.
bpy.ops.object.select_all(action="DESELECT")
for o in list(bpy.data.objects):
    if o not in (body, wheel):
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=str(OUT / "car.glb"), export_format="GLB", use_selection=True, export_yup=True,
                          export_apply=True)
print("[world] wrote car.glb")
