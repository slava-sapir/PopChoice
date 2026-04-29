# TMDB Popular Movie Import

This script imports popular movies from TMDB into the existing `movies` vector table.

## Dry run

```cmd
npm run import:tmdb -- --limit 50 --dry-run
```

This writes `data/tmdb-popular.preview.json` and does not call OpenAI or Supabase.

## Real import

```cmd
npm run import:tmdb -- --limit 50
```

This fetches movie metadata from TMDB, creates OpenAI embeddings from each movie's content text, and upserts rows into Supabase.

## Why this is useful

The original Scrimba dataset has 12 movies. Adding 50 popular movies makes similarity search more interesting and gives the app a better chance to return useful matches.