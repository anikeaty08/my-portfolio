// Rebuilds every 3D asset: the island world, the car, hero/preview renders and project-board
// thumbnails (all from scripts/blender/build_world.py), then meshopt-compresses the GLBs.
// Set BLENDER to your blender executable if it is not on PATH.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const blender = [
  process.env.BLENDER,
  "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe",
  "/Applications/Blender.app/Contents/MacOS/Blender",
].find((p) => p && existsSync(p)) ?? "blender";

const steps = [["scripts/blender/build_world.py", "public/world"]];

for (const [script, ...args] of steps) {
  console.log(`\n> ${script}`);
  const res = spawnSync(blender, ["--background", "--factory-startup", "--python", script, "--", ...args], { stdio: "inherit" });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

// Meshopt-compress what the site downloads (about 5x smaller). Node names survive; the game bakes the
// quantization transforms out at load time (src/game/bake.ts).
for (const name of ["world", "car"]) {
  const file = `public/world/${name}.glb`;
  console.log(`\n> meshopt ${file}`);
  const res = spawnSync("npx", ["gltf-transform", "meshopt", file, file], { stdio: "inherit", shell: true });
  if (res.status !== 0) process.exit(res.status ?? 1);
}
