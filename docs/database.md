# PopChoice Supabase Schema

Step 4 creates the database shape for semantic movie search.

## Why this schema exists

Each movie is stored once in `public.movies`. The plain text lives in `content`, and the matching vector lives in `embedding`. The app will later create one embedding from the group's answers and call `match_movies` to find semantically similar movie rows.

## Embedding choice

We are using `text-embedding-3-small` with 1536 dimensions. The database column is therefore `extensions.vector(1536)`. If we later change embedding models or pass a custom `dimensions` value, this column and the app config must change together.

## Security choice

Row level security is enabled, but no anonymous read/write policies are added yet. The app should query this table from server-side code using `SUPABASE_SERVICE_ROLE_KEY`. That keeps vector search, OpenAI calls, and database writes off the browser.

## Similarity function

`match_movies` uses cosine distance with pgvector's `<=>` operator and converts it into similarity with:

```sql
1 - (movies.embedding <=> query_embedding)
```

The function also accepts `max_runtime_minutes`, so the first screen's time input can become a real database filter.

## How to run later

When your Supabase project is ready, run the SQL in:

```text
supabase/migrations/0001_init_movies_vector_search.sql
```

You can paste it into the Supabase SQL editor, or later run it through the Supabase CLI.