# Movie Parsing

Step 5 turns `movie.txt` into structured records before embeddings are created.

## Why parse first?

Embeddings work best when each text unit has a clear meaning. In this dataset, each movie already forms a natural chunk, so we parse one movie block into one future database row.

## Record shape

Each parsed movie contains:

- `slug`
- `title`
- `releaseYear`
- `ageRating`
- `runtimeMinutes`
- `audienceRating`
- `description`
- `content`
- `metadata`

`content` is the exact text we will send to the embedding model later. It combines the title, metadata, and description so semantic search can match both plot and practical constraints.

## How to run

```cmd
npm run parse:movies
```

This writes:

```text
data/movies.parsed.json
```