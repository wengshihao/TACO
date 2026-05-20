import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

if (!existsSync("dist/index.html") || !existsSync("dist/assets")) {
  console.error("dist/ is missing. Run npm run build first.");
  process.exit(1);
}

await cp("dist/index.html", "index.html");
await rm("assets", { recursive: true, force: true });
await cp("dist/assets", "assets", { recursive: true });

if (existsSync("dist/benchmark/index.html")) {
  await mkdir("benchmark", { recursive: true });
  await cp("dist/benchmark/index.html", "benchmark/index.html");
}

console.log("Synced dist/index.html and dist/assets into the repository root for GitHub Pages main/root hosting.");
