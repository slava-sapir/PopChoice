-- PopChoice database setup
-- Run this in the Supabase SQL editor, or later through the Supabase CLI.

create extension if not exists vector with schema extensions;

create table if not exists public.movies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  release_year integer,
  age_rating text,
  runtime_minutes integer,
  audience_rating numeric(3, 1),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding_model text not null default 'text-embedding-3-small',
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.movies is 'Movie records and OpenAI embeddings used by PopChoice similarity search.';
comment on column public.movies.content is 'The full text sent to the embedding model: title, facts, and description.';
comment on column public.movies.embedding is '1536-dimension embedding from text-embedding-3-small.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_movies_updated_at on public.movies;
create trigger set_movies_updated_at
before update on public.movies
for each row
execute function public.set_updated_at();

-- HNSW is the recommended pgvector index for fast approximate nearest-neighbor search.
-- It is not important for 12 movies, but it is the right production habit as the table grows.
create index if not exists movies_embedding_hnsw_idx
on public.movies
using hnsw (embedding extensions.vector_cosine_ops)
where embedding is not null;

create index if not exists movies_runtime_minutes_idx
on public.movies (runtime_minutes);

alter table public.movies enable row level security;

-- We intentionally do not add public anon policies yet.
-- The Next.js server will query with SUPABASE_SERVICE_ROLE_KEY so API keys and vectors stay server-side.

create or replace function public.match_movies(
  query_embedding extensions.vector(1536),
  match_threshold float default 0.72,
  match_count int default 5,
  max_runtime_minutes int default null
)
returns table (
  id uuid,
  slug text,
  title text,
  release_year integer,
  age_rating text,
  runtime_minutes integer,
  audience_rating numeric,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    movies.id,
    movies.slug,
    movies.title,
    movies.release_year,
    movies.age_rating,
    movies.runtime_minutes,
    movies.audience_rating,
    movies.content,
    movies.metadata,
    1 - (movies.embedding <=> query_embedding) as similarity
  from public.movies
  where movies.embedding is not null
    and (max_runtime_minutes is null or movies.runtime_minutes <= max_runtime_minutes)
    and 1 - (movies.embedding <=> query_embedding) >= match_threshold
  order by movies.embedding <=> query_embedding asc
  limit least(match_count, 20);
$$;