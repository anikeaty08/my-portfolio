"""Renders a card image for each project model (used by the classic site).

blender --background --factory-startup --python scripts/blender/render_thumbs.py -- <models_dir> <out_dir>
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
MODELS, OUT = Path(args[0]).resolve(), Path(args[1]).resolve()  # render paths must be absolute
OUT.mkdir(parents=True, exist_ok=True)

# slug -> card background, matches `color` in src/content.ts
PROJECTS = {
    "polychat": "#a78bfa",
    "ragg": "#38bdf8",
    "equiclear": "#2dd4bf",
    "poolguard": "#34d399",
    "astraos": "#fb923c",
    "mlviz": "#f472b6",
}


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


scene = bpy.context.scene
for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
    try:
        scene.render.engine = eng
        break
    except TypeError:
        continue
scene.render.resolution_x, scene.render.resolution_y = 960, 600
scene.render.film_transparent = False
scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.quality = 82

for slug, color in PROJECTS.items():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.ops.import_scene.gltf(filepath=str(MODELS / f"{slug}.glb"))
    for o in bpy.context.scene.objects:
        if o.parent is None:
            o.rotation_euler.z += math.radians(-25)
    # a soft pastel floor to catch the shadow
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -1.25))
    floor = bpy.context.active_object
    m = bpy.data.materials.new("floor")
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*srgb(color), 1)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    floor.data.materials.append(m)

    bpy.ops.object.light_add(type="SUN", rotation=(math.radians(40), math.radians(15), math.radians(30)))
    bpy.context.active_object.data.energy = 4.5
    world = scene.world or bpy.data.worlds.new("w")
    scene.world = world
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (*srgb(color), 1)
    bg.inputs["Strength"].default_value = 0.9

    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    scene.collection.objects.link(cam)
    cam.location = (0, -6.2, 2.4)
    cam.data.lens = 50
    cam.rotation_euler = (Vector((0, 0, -0.1)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = str(OUT / f"{slug}.webp")
    bpy.ops.render.render(write_still=True)
    print("[thumbs] wrote", scene.render.filepath)
