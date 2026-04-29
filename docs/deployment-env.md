# Local And Vercel Environment Setup

## Local

Create `.env.local` in the project root. Use `.env.example` as the template.

Check local env values without printing secrets:

```cmd
npm run check:env
```

Required locally:

- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional but recommended:

- `OPENAI_CHAT_MODEL`
- `TMDB_API_KEY`

## Vercel

Add the same variables in:

```text
Vercel Project -> Settings -> Environment Variables
```

Use these scopes unless you have a reason to separate them:

```text
Production
Preview
Development
```

## Public vs Server-only

Browser-safe:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-only:

- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TMDB_API_KEY`

Never expose the service role key or OpenAI key in client components.

## Database Setup

Run the SQL migration in Supabase before deploying:

```text
supabase/migrations/0001_init_movies_vector_search.sql
```

Then seed data from a trusted local/server environment:

```cmd
npm run parse:movies
npm run embed:movies
npm run import:tmdb -- --limit 50
npm run check:movies
```

Do not run seed scripts from browser code.