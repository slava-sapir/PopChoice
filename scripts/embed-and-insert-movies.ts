import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import OpenAI from "openai";

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from "../src/lib/ai/config";
import type { ParsedMovie } from "../src/lib/movies";

type MovieRow = {
  slug: string;
  title: string;
  release_year: number;
  age_rating: string;
  runtime_minutes: number;
  audience_rating: number;
  content: string;
  metadata: ParsedMovie["metadata"] & {
    description: string;
  };
  embedding_model: string;
  embedding: number[];
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const envPath = path.join(projectRoot, ".env.local");

loadEnv({ path: envPath, quiet: true });

const parsedMoviesPath = path.join(projectRoot, "data", "movies.parsed.json");
const embeddedMoviesPath = path.join(projectRoot, "data", "movies.embedded.json");
const shouldWriteJson = process.argv.includes("--write-json");
const shouldSkipDb = process.argv.includes("--skip-db");
const shouldCheck = process.argv.includes("--check");

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local before running this script.`);
  }

  return value;
}

function readParsedMovies() {
  if (!fs.existsSync(parsedMoviesPath)) {
    throw new Error("Missing data/movies.parsed.json. Run npm run parse:movies first.");
  }

  return JSON.parse(fs.readFileSync(parsedMoviesPath, "utf8")) as ParsedMovie[];
}

async function main() {
  const movies = readParsedMovies();
  console.log(`Loaded ${movies.length} parsed movies`);

  if (movies.length === 0) {
    throw new Error("No movies found in data/movies.parsed.json.");
  }

  const openAiKey = requireEnv("OPENAI_API_KEY");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (shouldCheck) {
    console.log("Environment and parsed movie data look ready.");
    console.log(`Embedding model: ${EMBEDDING_MODEL}`);
    console.log(`Expected dimensions: ${EMBEDDING_DIMENSIONS}`);
    return;
  }

  const openai = new OpenAI({ apiKey: openAiKey });

  console.log(`Creating ${EMBEDDING_MODEL} embeddings...`);
  const embeddings = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: movies.map((movie) => movie.content),
    encoding_format: "float",
  });

  const rows: MovieRow[] = embeddings.data
    .sort((a, b) => a.index - b.index)
    .map((item, index) => {
      const movie = movies[index];

      if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `${movie.title} embedding has ${item.embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}.`,
        );
      }

      return {
        slug: movie.slug,
        title: movie.title,
        release_year: movie.releaseYear,
        age_rating: movie.ageRating,
        runtime_minutes: movie.runtimeMinutes,
        audience_rating: movie.audienceRating,
        content: movie.content,
        metadata: {
          ...movie.metadata,
          description: movie.description,
        },
        embedding_model: EMBEDDING_MODEL,
        embedding: item.embedding,
      };
    });

  console.log(`Created ${rows.length} embeddings`);

  if (shouldWriteJson) {
    fs.writeFileSync(embeddedMoviesPath, `${JSON.stringify(rows, null, 2)}\n`);
    console.log(`Wrote ${path.relative(projectRoot, embeddedMoviesPath)}`);
  }

  if (shouldSkipDb) {
    console.log("Skipping Supabase upsert because --skip-db was passed.");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log("Upserting movies into Supabase...");
  const { error } = await supabase.from("movies").upsert(rows, {
    onConflict: "slug",
  });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  console.log(`Inserted or updated ${rows.length} movies in Supabase.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});