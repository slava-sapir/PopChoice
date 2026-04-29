import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { findMovieMatches } from "../src/lib/recommendations/server";
import type { RecommendationRequest } from "../src/lib/recommendations/types";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
loadEnv({ path: path.join(projectRoot, ".env.local"), quiet: true });

const request: RecommendationRequest = {
  watchMinutes: 130,
  people: [
    {
      favoriteMovie: "The Martian because it is smart, tense, hopeful, and funny.",
      era: "New",
      mood: "Inspiring",
      islandPerson: "Matt Damon because he seems practical and calm in survival stories.",
    },
    {
      favoriteMovie: "Knives Out because I like clever mysteries with jokes and twists.",
      era: "New",
      mood: "Fun",
      islandPerson: "Daniel Craig because he would make the situation entertaining.",
    },
  ],
};

async function main() {
  const result = await findMovieMatches(request);

  console.log("Group preference text:");
  console.log(result.groupPreferenceText);
  console.log("\nAI recommendations:");

  for (const match of result.recommendations) {
    console.log(
      `- ${match.title} (${match.release_year}) | ${match.runtime_minutes} min | similarity ${(match.similarity * 100).toFixed(1)}%`,
    );
    console.log(`  Poster: ${match.poster_url ?? "fallback poster"}`);
    console.log(`  Summary: ${match.ai_summary}`);
    console.log(`  Reason: ${match.ai_reason}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});