// Rebuilds every 3D asset by running the Blender scripts headless, in dependency order:
//   project models -> island world (imports the models) -> classic-site thumbnails.
// Set BLENDER to your blender executable if it is not on PATH.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const blender = [
  process.env.BLENDER,
  "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe",
  "/Applications/Blender.app/Contents/MacOS/Blender",
].find((p) => p && existsSync(p)) ?? "blender";

const steps = [
  ["scripts/blender/build_models.py", "public/models"],
  ["scripts/blender/build_world.py", "public/models", "public/world"],
  ["scripts/blender/render_thumbs.py", "public/models", "public/world/thumbs"],
];

for (const [script, ...args] of steps) {
  console.log(`\n> ${script}`);
  const res = spawnSync(blender, ["--background", "--factory-startup", "--python", script, "--", ...args], { stdio: "inherit" });
  if (res.status !== 0) process.exit(res.status ?? 1);
}
