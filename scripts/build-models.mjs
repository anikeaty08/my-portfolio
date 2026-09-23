// Rebuilds public/models/*.glb by running the Blender modeling script headless.
// Set BLENDER to your blender executable if it is not on PATH.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const candidates = [
  process.env.BLENDER,
  "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe",
  "/Applications/Blender.app/Contents/MacOS/Blender",
  "blender",
].filter(Boolean);
const blender = candidates.find((p) => p === "blender" || existsSync(p));

const res = spawnSync(
  blender,
  ["--background", "--factory-startup", "--python", "scripts/blender/build_models.py", "--", "public/models"],
  { stdio: "inherit" },
);
process.exit(res.status ?? 1);
