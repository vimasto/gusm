import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRE = createRequire(import.meta.url);
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const APP_DIRECTORY = resolve(SCRIPT_DIRECTORY, "..");
const CATALOG_SOURCE_PATH = join(APP_DIRECTORY, "lib", "routines", "catalog.ts");
const ASSET_DIRECTORY = join(APP_DIRECTORY, "public", "routine-exercises");
const MANIFEST_PATH = REQUIRE.resolve("@bryllim/workout-guide/manifest.json");
const PACKAGE_DIRECTORY = dirname(MANIFEST_PATH);

function getAllowedExerciseSlugs(catalogSource) {
  return [...catalogSource.matchAll(/^  "([a-z0-9-]+)",$/gmu)].map((match) => match[1]);
}

async function syncRoutineAssets() {
  const catalogSource = await readFile(CATALOG_SOURCE_PATH, "utf8");
  const allowedExerciseSlugs = getAllowedExerciseSlugs(catalogSource);
  if (allowedExerciseSlugs.length === 0) {
    throw new Error("Routine exercise allowlist is empty.");
  }

  await mkdir(ASSET_DIRECTORY, { recursive: true });
  await copyFile(
    join(PACKAGE_DIRECTORY, "ATTRIBUTION.md"),
    join(ASSET_DIRECTORY, "ATTRIBUTION.md"),
  );

  for (const exerciseSlug of allowedExerciseSlugs) {
    const sourceDirectory = join(PACKAGE_DIRECTORY, "assets", exerciseSlug);
    const targetDirectory = join(ASSET_DIRECTORY, exerciseSlug);
    await mkdir(targetDirectory, { recursive: true });

    for (const frameIndex of [1, 2, 3]) {
      const fileName = `frame-${frameIndex}.png`;
      await copyFile(join(sourceDirectory, fileName), join(targetDirectory, fileName));
    }
  }
}

await syncRoutineAssets();
