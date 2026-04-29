import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findMoviePosterUrl } from "../src/lib/recommendations/posters";

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDir, "..");
  loadEnv({ path: path.join(projectRoot, ".env.local"), quiet: true });

  const title = process.argv[2] ?? "Asteroid City";
  const year = Number(process.argv[3] ?? "2023");

  const posterUrl = await findMoviePosterUrl({ title, year });
  console.log(`${title} (${year}): ${posterUrl ?? "no poster found"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});