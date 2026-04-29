# Movie Posters

Step 9 adds optional poster enrichment using TMDB.

## Flow

1. Supabase returns movie matches.
2. OpenAI Chat Completions ranks and explains those matches.
3. The server searches TMDB by movie title and year.
4. If TMDB returns a `poster_path`, the app renders `https://image.tmdb.org/t/p/w500/...`.
5. If `TMDB_API_KEY` is missing or no poster is found, the UI falls back to local Figma poster assets.

## Required env var

```env
TMDB_API_KEY=your_tmdb_api_read_access_token
```

Use the TMDB API Read Access Token. The server sends it as a Bearer token, so it must stay server-side.