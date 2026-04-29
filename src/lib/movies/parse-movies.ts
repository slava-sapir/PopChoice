export type ParsedMovie = {
  slug: string;
  title: string;
  releaseYear: number;
  ageRating: string;
  runtimeMinutes: number;
  audienceRating: number;
  description: string;
  content: string;
  metadata: {
    source: "movie.txt";
    runtimeLabel: string;
    header: string;
  };
};

const movieHeaderPattern = /^(.+):\s+(\d{4})\s+\|\s+([^|]+)\s+\|\s+([^|]+)\s+\|\s+(\d+(?:\.\d+)?)\s+rating$/;

export function parseMoviesFile(fileContents: string): ParsedMovie[] {
  const normalizedContents = fileContents.replace(/\r\n/g, "\n").trim();

  if (!normalizedContents) {
    return [];
  }

  return normalizedContents
    .split(/\n{2,}/)
    .map((block, index) => parseMovieBlock(block, index));
}

function parseMovieBlock(block: string, index: number): ParsedMovie {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const header = lines[0];
  const description = lines.slice(1).join(" ");

  if (!header || !description) {
    throw new Error(`Movie block ${index + 1} is missing a header or description.`);
  }

  const match = header.match(movieHeaderPattern);

  if (!match) {
    throw new Error(`Movie block ${index + 1} has an invalid header: ${header}`);
  }

  const [, rawTitle, rawReleaseYear, rawAgeRating, rawRuntime, rawAudienceRating] = match;
  const title = rawTitle.trim();
  const ageRating = rawAgeRating.trim();
  const runtimeLabel = rawRuntime.trim();
  const runtimeMinutes = parseRuntimeMinutes(runtimeLabel);
  const releaseYear = Number(rawReleaseYear);
  const audienceRating = Number(rawAudienceRating);

  return {
    slug: slugify(title),
    title,
    releaseYear,
    ageRating,
    runtimeMinutes,
    audienceRating,
    description,
    content: buildEmbeddingContent({
      title,
      releaseYear,
      ageRating,
      runtimeLabel,
      audienceRating,
      description,
    }),
    metadata: {
      source: "movie.txt",
      runtimeLabel,
      header,
    },
  };
}

function buildEmbeddingContent({
  title,
  releaseYear,
  ageRating,
  runtimeLabel,
  audienceRating,
  description,
}: {
  title: string;
  releaseYear: number;
  ageRating: string;
  runtimeLabel: string;
  audienceRating: number;
  description: string;
}) {
  return [
    `Title: ${title}`,
    `Year: ${releaseYear}`,
    `Age rating: ${ageRating}`,
    `Runtime: ${runtimeLabel}`,
    `Audience rating: ${audienceRating}`,
    `Description: ${description}`,
  ].join("\n");
}

function parseRuntimeMinutes(runtime: string) {
  const hours = runtime.match(/(\d+)h/);
  const minutes = runtime.match(/(\d+)m/);

  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}