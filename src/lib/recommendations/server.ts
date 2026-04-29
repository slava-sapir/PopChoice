import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

import {
  DEFAULT_MATCH_COUNT,
  DEFAULT_MATCH_THRESHOLD,
  EMBEDDING_MODEL,
} from "@/lib/ai/config";
import { getServerEnv } from "@/lib/env/server";
import { PublicError } from "@/lib/recommendations/errors";
import { formatGroupPreferences } from "@/lib/recommendations/format-preferences";
import { findMoviePosterUrl } from "@/lib/recommendations/posters";
import type {
  MovieMatch,
  MovieRecommendation,
  RecommendationRequest,
  RecommendationResponse,
} from "@/lib/recommendations/types";

type ChatRecommendation = {
  slug: string;
  summary: string;
  reason: string;
};

export async function findMovieMatches(
  request: RecommendationRequest,
): Promise<RecommendationResponse> {
  validateRecommendationRequest(request);

  const env = getServerEnv();

  const groupPreferenceText = formatGroupPreferences(request);
  const openai = new OpenAI({ apiKey: env.openAiApiKey });

  const embeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: groupPreferenceText,
    encoding_format: "float",
  });

  const queryEmbedding = embeddingResponse.data[0]?.embedding;

  if (!queryEmbedding) {
    throw new PublicError("We could not understand those preferences. Please try again.", 502);
  }

  const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.rpc("match_movies", {
    query_embedding: queryEmbedding,
    match_threshold: DEFAULT_MATCH_THRESHOLD,
    match_count: DEFAULT_MATCH_COUNT,
    max_runtime_minutes: request.watchMinutes,
  });

  if (error) {
    console.error(error);
    throw new PublicError("The movie database could not be searched right now.", 502);
  }

  const matches = (data ?? []) as MovieMatch[];

  return {
    groupPreferenceText,
    matches,
    recommendations: await createConversationalRecommendations({
      groupPreferenceText,
      matches,
      openai,
    }),
  };
}

async function createConversationalRecommendations({
  groupPreferenceText,
  matches,
  openai,
}: {
  groupPreferenceText: string;
  matches: MovieMatch[];
  openai: OpenAI;
}): Promise<MovieRecommendation[]> {
  if (matches.length === 0) {
    return [];
  }

  const chatModel = getServerEnv().openAiChatModel;
  const completion = await openai.chat.completions.create({
    model: chatModel,
    messages: [
      {
        role: "developer",
        content:
          "You are PopChoice, a concise movie recommender. Only recommend movies from the provided candidate list. Do not invent titles. Rank candidates for the group, explain the match, and keep language friendly.",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            groupPreferenceText,
            candidateMovies: matches.map((match) => ({
              slug: match.slug,
              title: match.title,
              year: match.release_year,
              runtimeMinutes: match.runtime_minutes,
              ageRating: match.age_rating,
              audienceRating: match.audience_rating,
              similarity: match.similarity,
              description: match.metadata.description,
            })),
          },
          null,
          2,
        ),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "popchoice_recommendations",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            recommendations: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  slug: { type: "string" },
                  summary: { type: "string" },
                  reason: { type: "string" },
                },
                required: ["slug", "summary", "reason"],
              },
            },
          },
          required: ["recommendations"],
        },
      },
    },
  });

  const rawContent = completion.choices[0]?.message.content;

  if (!rawContent) {
    return matches.map(toFallbackRecommendation);
  }

  let parsed: { recommendations: ChatRecommendation[] };

  try {
    parsed = JSON.parse(rawContent) as { recommendations: ChatRecommendation[] };
  } catch (error) {
    console.error(error);
    return matches.map(toFallbackRecommendation);
  }
  const matchesBySlug = new Map(matches.map((match) => [match.slug, match]));
  const rankedRecommendations = parsed.recommendations
    .map((recommendation) => {
      const match = matchesBySlug.get(recommendation.slug);

      if (!match) {
        return null;
      }

      return {
        ...match,
        ai_summary: recommendation.summary,
        ai_reason: recommendation.reason,
      };
    })
    .filter((recommendation): recommendation is MovieRecommendation => recommendation !== null);

  const recommendations = rankedRecommendations.length > 0
    ? rankedRecommendations
    : matches.map(toFallbackRecommendation);

  return Promise.all(
    recommendations.map(async (recommendation) => ({
      ...recommendation,
      poster_url: await findMoviePosterUrl({
        title: recommendation.title,
        year: recommendation.release_year,
      }),
    })),
  );
}

function toFallbackRecommendation(match: MovieMatch): MovieRecommendation {
  return {
    ...match,
    ai_summary: match.metadata.description ?? "This movie matched the group's preferences.",
    ai_reason: "This title was one of the closest semantic matches from the movie vector database.",
    poster_url: null,
  };
}

function validateRecommendationRequest(request: RecommendationRequest) {
  if (!Number.isFinite(request.watchMinutes) || request.watchMinutes < 30) {
    throw new PublicError("Watch time must be at least 30 minutes.");
  }

  if (!Array.isArray(request.people) || request.people.length === 0) {
    throw new PublicError("At least one person is required.");
  }

  if (request.people.length > 8) {
    throw new PublicError("PopChoice supports up to 8 people for now.");
  }

  for (const [index, person] of request.people.entries()) {
    const values = [
      person.favoriteMovie,
      person.era,
      person.mood,
      person.islandPerson,
    ];

    if (values.some((value) => typeof value !== "string" || value.trim().length === 0)) {
      throw new PublicError(`Person ${index + 1} is missing one or more answers.`);
    }
  }
}
