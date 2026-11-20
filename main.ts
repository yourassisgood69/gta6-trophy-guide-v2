import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { buildDossier } from "./vendor/makefun-frontend.ts";

const repoRoot = fileURLToPath(new URL(".", import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

await mkdir(outputDir, { recursive: true });

const appSource = join(repoRoot, "app");
const appTarget = join(outputDir, "app");
await cp(appSource, appTarget, { recursive: true });

const screenshotsTarget = join(outputDir, "screenshots");
await mkdir(screenshotsTarget, { recursive: true });

const shotsSource = join(repoRoot, "screenshots");
try {
  const shotsInfo = await stat(shotsSource);
  if (shotsInfo.isDirectory()) {
    await cp(shotsSource, screenshotsTarget, { recursive: true });
  }
} catch {
  // No screenshots folder beside the program: the output keeps the empty one.
}

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000
});

await writeFile(join(outputDir, "dossier.json"), dossier);
