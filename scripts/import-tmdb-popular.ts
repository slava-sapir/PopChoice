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

type TmdbPopularResponse = {
  page: number;
  total_pages: number;
  results: TmdbMovieSummary[];
};

type TmdbMovieSummary = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  adult: boolean;
  original_language: string;
  genre_ids: number[];
};

type TmdbMovieDetails = TmdbMovieSummary & {
  runtime: number | null;
  genres: Array<{ id: number; name: string }>;
  release_dates?: {
    results?: Array<{
      iso_3166_1: string;
      release_dates: Array<{
        certification: string;
      }>;
    }>;
  };
};

type MovieRow = {
  slug: string;
  title: string;
  release_year: number | null;
  age_rating: string | null;
  runtime_minutes: number | null;
  audience_rating: number;
  content: string;
  metadata: {
    source: "tmdb";
    tmdbId: number;
    description: string;
    genres: string[];
    releaseDate: string;
    posterPath?: string | null;
  };
  embedding_model: string;
  embedding: number[];
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
loadEnv({ path: path.join(projectRoot, ".env.local"), quiet: true });

const limit = readNumberFlag("--limit", 50);
const maxReleaseDate = readStringFlag("--max-release-date", new Date().toISOString().slice(0, 10));
const maxReleaseYear = Number(maxReleaseDate.slice(0, 4));
const shouldDryRun = process.argv.includes("--dry-run");
const shouldWriteJson = process.argv.includes("--write-json") || shouldDryRun;

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local before running this script.`);
  }

  return value;
}

async function main() {
  if (limit < 1 || limit > 200) {
    throw new Error("Use --limit between 1 and 200.");
  }

  requireEnv("OPENAI_API_KEY");
  requireEnv("TMDB_API_KEY");
  requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  console.log(`Fetching ${limit} popular movies from TMDB...`);
  const movies = await fetchPopularMovies(limit);
  console.log(`Fetched ${movies.length} movie details`);

  const rowsWithoutEmbeddings = movies.map(toMovieSeed);

  if (shouldDryRun) {
    const dryRunPath = path.join(projectRoot, "data", "tmdb-popular.preview.json");
    fs.writeFileSync(dryRunPath, `${JSON.stringify(rowsWithoutEmbeddings, null, 2)}\n`);
    console.log(`Dry run wrote ${path.relative(projectRoot, dryRunPath)}`);
    printMoviePreview(rowsWithoutEmbeddings);
    return;
  }

  const openai = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  console.log(`Creating ${EMBEDDING_MODEL} embeddings...`);
  const embeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: rowsWithoutEmbeddings.map((movie) => movie.content),
    encoding_format: "float",
  });

  const rows: MovieRow[] = embeddingResponse.data
    .sort((a, b) => a.index - b.index)
    .map((item, index) => {
      if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `${rowsWithoutEmbeddings[index].title} embedding has ${item.embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}.`,
        );
      }

      return {
        ...rowsWithoutEmbeddings[index],
        embedding: item.embedding,
      };
    });

  if (shouldWriteJson) {
    const outputPath = path.join(projectRoot, "data", "tmdb-popular.embedded.json");
    fs.writeFileSync(outputPath, `${JSON.stringify(rows, null, 2)}\n`);
    console.log(`Wrote ${path.relative(projectRoot, outputPath)}`);
  }

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  console.log("Upserting TMDB movies into Supabase...");
  const { error } = await supabase.from("movies").upsert(rows, {
    onConflict: "slug",
  });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }

  printMoviePreview(rows);
  console.log(`Inserted or updated ${rows.length} TMDB movies in Supabase.`);
}

async function fetchPopularMovies(targetCount: number) {
  const summaries: TmdbMovieSummary[] = [];
  let page = 1;

  while (summaries.length < targetCount) {
    const url = tmdbUrl("/3/discover/movie");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("page", String(page));
    url.searchParams.set("region", "US");
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("include_video", "false");
    url.searchParams.set("sort_by", "popularity.desc");
    url.searchParams.set("primary_release_date.lte", maxReleaseDate);
    url.searchParams.set("vote_count.gte", "100");

    const response = await tmdbFetch<TmdbPopularResponse>(url);
    summaries.push(
      ...response.results.filter(
        (movie) => !movie.adult && movie.overview && movie.release_date,
      ),
    );

    if (page >= response.total_pages) {
      break;
    }

    page += 1;
  }

  const selected = uniqueBy(summaries, (movie) => movie.id).slice(0, targetCount);
  const details: TmdbMovieDetails[] = [];

  for (const movie of selected) {
    details.push(await fetchMovieDetails(movie.id));
  }

  return details.filter((movie) => {
    const releaseYear = movie.release_date ? Number(movie.release_date.slice(0, 4)) : null;

    return movie.runtime && movie.overview && releaseYear && releaseYear <= maxReleaseYear;
  });
}

async function fetchMovieDetails(tmdbId: number) {
  const url = tmdbUrl(`/3/movie/${tmdbId}`);
  url.searchParams.set("language", "en-US");
  url.searchParams.set("append_to_response", "release_dates");

  return tmdbFetch<TmdbMovieDetails>(url);
}

async function tmdbFetch<ResponseBody>(url: URL) {
  const apiKey = requireEnv("TMDB_API_KEY");
  const headers: HeadersInit = {
    accept: "application/json",
  };

  if (apiKey.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    url.searchParams.set("api_key", apiKey);
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`TMDB request failed (${response.status}) for ${url.pathname}`);
  }

  return (await response.json()) as ResponseBody;
}

function tmdbUrl(pathname: string) {
  return new URL(pathname, "https://api.themoviedb.org");
}

function toMovieSeed(movie: TmdbMovieDetails): Omit<MovieRow, "embedding"> {
  const releaseYear = movie.release_date ? Number(movie.release_date.slice(0, 4)) : null;
  const ageRating = getUsCertification(movie) || null;
  const audienceRating = Number(movie.vote_average.toFixed(1));
  const genres = movie.genres.map((genre) => genre.name);
  const content = [
    `Title: ${movie.title}`,
    releaseYear ? `Year: ${releaseYear}` : null,
    ageRating ? `Age rating: ${ageRating}` : null,
    movie.runtime ? `Runtime: ${movie.runtime} minutes` : null,
    `Audience rating: ${audienceRating}`,
    genres.length > 0 ? `Genres: ${genres.join(", ")}` : null,
    `Description: ${movie.overview}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    slug: slugify(`${movie.title}-${releaseYear ?? movie.id}`),
    title: movie.title,
    release_year: releaseYear,
    age_rating: ageRating,
    runtime_minutes: movie.runtime,
    audience_rating: audienceRating,
    content,
    metadata: {
      source: "tmdb",
      tmdbId: movie.id,
      description: movie.overview,
      genres,
      releaseDate: movie.release_date,
      posterPath: movie.poster_path,
    },
    embedding_model: EMBEDDING_MODEL,
  };
}

function getUsCertification(movie: TmdbMovieDetails) {
  const usRelease = movie.release_dates?.results?.find(
    (release) => release.iso_3166_1 === "US",
  );

  return usRelease?.release_dates.find((release) => release.certification)?.certification ?? "";
}

function uniqueBy<Value>(values: Value[], getKey: (value: Value) => string | number) {
  const seen = new Set<string | number>();
  return values.filter((value) => {
    const key = getKey(value);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function readStringFlag(flag: string, fallback: string) {
  const index = process.argv.indexOf(flag);

  if (index === -1) {
    return fallback;
  }

  return process.argv[index + 1] ?? fallback;
}

function readNumberFlag(flag: string, fallback: number) {
  const index = process.argv.indexOf(flag);

  if (index === -1) {
    return fallback;
  }

  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}

function printMoviePreview(movies: Array<Omit<MovieRow, "embedding"> | MovieRow>) {
  for (const movie of movies.slice(0, 10)) {
    console.log(
      `- ${movie.title} (${movie.release_year ?? "unknown"}) | ${movie.runtime_minutes ?? "?"} min | ${movie.age_rating ?? "unrated"} | ${movie.audience_rating}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});