"""Renders a contact sheet of every GLB in public/models (sanity check for the modeling script)."""
import math
import sys
from pathlib import Path

import bpy

models = Path("public/models")
out = sys.argv[sys.argv.index("--") + 1]
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
files = sorted(models.glob("*.glb"))
cols = 3
for i, f in enumerate(files):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(f))
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.parent is None:
            o.location = ((i % cols - 1) * 3.2, 0, -(i // cols - 1) * 3.2)
            o.rotation_euler = (math.radians(90) + math.radians(20), 0, math.radians(-25))
bpy.ops.object.camera_add(location=(0, -16, 0), rotation=(math.radians(90), 0, 0))
cam = bpy.context.active_object
cam.data.type = "ORTHO"
cam.data.ortho_scale = 10.5
bpy.context.scene.camera = cam
bpy.ops.object.light_add(type="SUN", rotation=(math.radians(50), math.radians(10), math.radians(-30)))
bpy.context.active_object.data.energy = 4
world = bpy.data.worlds.new("w") if not bpy.context.scene.world else bpy.context.scene.world
bpy.context.scene.world = world
try:
    world.color = (0.05, 0.05, 0.07)
except Exception:
    pass
s = bpy.context.scene
for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "CYCLES"):
    try:
        s.render.engine = eng
        break
    except TypeError:
        continue
s.render.resolution_x, s.render.resolution_y = 1200, 1200
s.render.filepath = out
bpy.ops.render.render(write_still=True)
print("[preview] wrote", out)
