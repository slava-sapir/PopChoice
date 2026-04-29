export type PersonAnswers = {
  favoriteMovie: string;
  era: string;
  mood: string;
  islandPerson: string;
};

export type RecommendationRequest = {
  watchMinutes: number;
  people: PersonAnswers[];
};

export type MovieMatch = {
  id: string;
  slug: string;
  title: string;
  release_year: number | null;
  age_rating: string | null;
  runtime_minutes: number | null;
  audience_rating: number | null;
  content: string;
  metadata: {
    description?: string;
    runtimeLabel?: string;
    source?: string;
    header?: string;
    [key: string]: unknown;
  };
  similarity: number;
};

export type MovieRecommendation = MovieMatch & {
  ai_reason: string;
  ai_summary: string;
  poster_url: string | null;
};

export type RecommendationResponse = {
  groupPreferenceText: string;
  matches: MovieMatch[];
  recommendations: MovieRecommendation[];
};