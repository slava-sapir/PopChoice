# Movie Embeddings

Step 6 creates vector embeddings for the parsed movie records and inserts them into Supabase.

## What this script does

`npm run embed:movies`:

1. Loads `.env.local`.
2. Reads `data/movies.parsed.json`.
3. Sends every movie `content` field to OpenAI's embeddings endpoint in one batch.
4. Verifies each vector has 1536 dimensions.
5. Upserts the movie rows into `public.movies` using `slug` as the conflict key.

## Required setup before running for real

Create `.env.local` in the project root:

```env
OPENAI_API_KEY=your_openai_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
TMDB_API_KEY=
```

Then run the SQL migration from:

```text
supabase/migrations/0001_init_movies_vector_search.sql
```

in your Supabase SQL editor.

## Commands

Check that env vars and parsed data are present:

```cmd
npm run embed:movies -- --check
```

Create embeddings and write a local JSON copy without inserting into Supabase:

```cmd
npm run embed:movies -- --write-json --skip-db
```

Create embeddings and insert into Supabase:

```cmd
npm run embed:movies
```

## Important security note

Use `SUPABASE_SERVICE_ROLE_KEY` only from server-side scripts or server-side Next.js code. Never expose it in React client components.
## Step 7 query behavior

For the small 12-movie dataset, `DEFAULT_MATCH_THRESHOLD` is intentionally low (`0.35`). With tiny datasets, a strict threshold can return no rows even when the top matches are still useful. The app asks Supabase for the best matches, then later OpenAI will explain and rank those candidates conversationally.
