import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseMoviesFile } from "../src/lib/movies";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const movieFilePath = path.join(projectRoot, "movie.txt");

const fileContents = fs.readFileSync(movieFilePath, "utf8");
const movies = parseMoviesFile(fileContents);

const outputPath = path.join(projectRoot, "data", "movies.parsed.json");
fs.writeFileSync(outputPath, `${JSON.stringify(movies, null, 2)}\n`);

console.log(`Parsed ${movies.length} movies`);
for (const movie of movies) {
  console.log(
    `- ${movie.title} (${movie.releaseYear}) | ${movie.runtimeMinutes} min | ${movie.ageRating} | ${movie.audienceRating}`,
  );
}
console.log(`Wrote ${path.relative(projectRoot, outputPath)}`);