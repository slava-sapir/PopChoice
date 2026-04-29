import { NextResponse } from "next/server";

import { getPublicErrorResponse } from "@/lib/recommendations/errors";
import { findMovieMatches } from "@/lib/recommendations/server";
import type { RecommendationRequest } from "@/lib/recommendations/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecommendationRequest;
    const response = await findMovieMatches(body);

    return NextResponse.json(response);
  } catch (error) {
    const publicError = getPublicErrorResponse(error);

    return NextResponse.json(
      { error: publicError.message },
      { status: publicError.status },
    );
  }
}