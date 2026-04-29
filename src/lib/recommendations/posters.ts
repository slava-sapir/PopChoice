type TmdbSearchResponse = {
  results?: Array<{
    poster_path?: string | null;
    release_date?: string;
    title?: string;
  }>;
};

const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

export async function findMoviePosterUrl({
  title,
  year,
}: {
  title: string;
  year: number | null;
}) {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return null;
  }

  const url = new URL("https://api.themoviedb.org/3/search/movie");
  url.searchParams.set("query", title);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "en-US");

  if (year) {
    url.searchParams.set("year", String(year));
  }

  const headers: HeadersInit = {
    accept: "application/json",
  };

  // TMDB supports long v4 read tokens as Bearer auth and older 32-char v3 keys as api_key.
  if (apiKey.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    url.searchParams.set("api_key", apiKey);
  }

  const response = await fetch(url, {
    headers,
    next: {
      revalidate: 60 * 60 * 24 * 7,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as TmdbSearchResponse;
  const result = data.results?.find((movie) => Boolean(movie.poster_path));

  if (!result?.poster_path) {
    return null;
  }

  return `${TMDB_IMAGE_BASE_URL}${result.poster_path}`;
}