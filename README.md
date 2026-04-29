# PopChoice

PopChoice is a hands-on AI Engineering project inspired by the Scrimba embeddings/vector database section. The app collects movie preferences from a group, turns those answers into one group preference embedding, searches a Supabase vector database for semantically similar movies, and asks OpenAI to explain the best recommendations.

## What The App Does

1. Ask how many people are watching and how much time they have.
2. Ask each person four preference questions.
3. Combine all answers into one group preference text.
4. Create an OpenAI embedding for that group text.
5. Query Supabase `pgvector` with similarity search.
6. Send the matched candidate movies to OpenAI Chat Completions.
7. Show ranked recommendations with posters, year, runtime, rating, summary, and reason.

## Tech Stack

- Next.js App Router
- React
- Tailwind CSS
- shadcn-style UI primitives
- OpenAI embeddings and Chat Completions
- Supabase Postgres with `pgvector`
- TMDB for movie posters and optional movie imports

## AI Flow

```text
User answers
-> formatGroupPreferences(...)
-> OpenAI text-embedding-3-small
-> Supabase match_movies(...) RPC
-> OpenAI Chat Completions with matched candidates only
-> UI recommendation cards
```

The chat model is not allowed to invent movie titles. It only ranks/explains movies that came back from Supabase.

## Environment Variables

Create `.env.local` in the project root:

```env
OPENAI_API_KEY=your_openai_key
OPENAI_CHAT_MODEL=gpt-4.1-mini

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_secret_or_service_role_key

TMDB_API_KEY=your_tmdb_v3_key_or_v4_read_access_token
```

Security notes:

- Do not commit `.env.local`.
- `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `TMDB_API_KEY` must stay server-side.
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are safe for browser exposure.

## Supabase Setup

Run the SQL migration in Supabase SQL Editor:

```text
supabase/migrations/0001_init_movies_vector_search.sql
```

This creates:

- `public.movies`
- `embedding vector(1536)`
- HNSW vector index
- `match_movies(...)` RPC function
- row level security enabled

The app queries the database from server-side code using the service role key.

## Local Development

Install dependencies:

```cmd
npm install
```

Run the app:

```cmd
npm run dev
```

Open:

```text
http://localhost:3000
```

In PowerShell on this machine, use `npm.cmd` if `npm` is blocked by script execution policy:

```powershell
npm.cmd run dev
```

## Data And Scripts

Parse the original Scrimba movie file:

```cmd
npm run parse:movies
```

Create embeddings for parsed movies and insert them into Supabase:

```cmd
npm run embed:movies
```

Check movie table count:

```cmd
npm run check:movies
```

Test vector search and AI explanations from the command line:

```cmd
npm run query:movies
```

Check TMDB poster lookup:

```cmd
npm run check:poster -- "Asteroid City" 2023
```

Preview 50 popular TMDB movies without writing to Supabase:

```cmd
npm run import:tmdb -- --limit 50 --dry-run
```

Import 50 popular TMDB movies, create embeddings, and upsert into Supabase:

```cmd
npm run import:tmdb -- --limit 50
```

## Important Files

- `src/app/page.tsx` - main UI flow
- `src/app/api/recommendations/route.ts` - recommendation API endpoint
- `src/lib/recommendations/server.ts` - embedding, vector search, chat completion orchestration
- `src/lib/recommendations/format-preferences.ts` - converts answers into group preference text
- `src/lib/recommendations/posters.ts` - TMDB poster lookup
- `src/lib/movies/parse-movies.ts` - parser for `movie.txt`
- `scripts/embed-and-insert-movies.ts` - seed original movie embeddings
- `scripts/import-tmdb-popular.ts` - import popular movies from TMDB
- `supabase/migrations/0001_init_movies_vector_search.sql` - database schema and vector search function

## Error Handling

The API returns friendly public messages for expected problems, such as missing answers or unavailable search. Internal details are logged on the server, not shown to the user.

The app handles:

- missing form answers
- missing or invalid environment configuration
- OpenAI embedding failures
- Supabase RPC failures
- malformed chat output fallback
- missing TMDB posters with local fallback images
- no matching movies found

## Deployment Notes

For Vercel:

1. Push the repo to GitHub.
2. Import the project into Vercel.
3. Add the same environment variables in Vercel Project Settings.
4. Run the Supabase migration in your Supabase project.
5. Run seed/import scripts locally or through a trusted server environment.

Do not expose service role keys or OpenAI keys to the browser.