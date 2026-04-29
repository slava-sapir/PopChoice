"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { RecommendationResponse } from "@/lib/recommendations/types";

const sampleRequest = {
  watchMinutes: 120,
  people: [
    {
      favoriteMovie: "The Grand Budapest Hotel because it is stylish, funny, and strange.",
      era: "New",
      mood: "Fun",
      islandPerson: "Wes Anderson because the island would at least have a perfect color palette.",
    },
    {
      favoriteMovie: "Arrival because it is thoughtful, emotional, and science fiction without feeling noisy.",
      era: "New",
      mood: "Inspiring",
      islandPerson: "Amy Adams because she seems calm, smart, and practical under pressure.",
    },
  ],
};

export default function DebugPage() {
  const [requestJson, setRequestJson] = useState(JSON.stringify(sampleRequest, null, 2));
  const [response, setResponse] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function runEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResponse(null);
    setIsLoading(true);

    try {
      const parsedRequest = JSON.parse(requestJson) as unknown;
      const apiResponse = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedRequest),
      });
      const payload = (await apiResponse.json()) as RecommendationResponse & { error?: string };

      if (!apiResponse.ok) {
        throw new Error(payload.error ?? "The evaluation request failed.");
      }

      setResponse(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[24px] border border-white/10 bg-[#000b3b] p-6 shadow-2xl shadow-black/60">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#47e982]">PopChoice Lab</p>
          <h1 className="mt-2 text-2xl font-bold tracking-normal">Recommendation debug page</h1>
          <p className="mt-3 text-sm leading-6 text-white/70">
            Use this page to test the full AI flow: formatted group text, vector matches, and final AI recommendations.
          </p>

          <form className="mt-5 space-y-4" onSubmit={runEvaluation}>
            <Textarea
              className="min-h-[420px] font-mono text-xs leading-5"
              onChange={(event) => setRequestJson(event.target.value)}
              value={requestJson}
            />
            {error && (
              <p className="rounded-md border border-red-300/40 bg-red-950/40 px-3 py-2 text-sm text-red-100">
                {error}
              </p>
            )}
            <Button className="w-full" disabled={isLoading} type="submit">
              {isLoading ? "Running Evaluation" : "Run Evaluation"}
            </Button>
          </form>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-[#07113d] p-6 shadow-2xl shadow-black/50">
          {!response ? (
            <div className="flex min-h-[540px] items-center justify-center text-center text-sm leading-6 text-white/60">
              Run the sample request to inspect the embedding search pipeline.
            </div>
          ) : (
            <div className="space-y-5">
              <DebugBlock title="Formatted Group Text">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{response.groupPreferenceText}</pre>
              </DebugBlock>

              <DebugBlock title="Vector Matches">
                <ol className="space-y-2 text-sm leading-5">
                  {response.matches.map((match) => (
                    <li className="rounded-md bg-white/5 p-3" key={match.id}>
                      <span className="font-bold text-white">{match.title}</span>
                      {match.release_year ? ` (${match.release_year})` : ""}
                      <span className="ml-2 text-[#47e982]">{(match.similarity * 100).toFixed(1)}%</span>
                      <p className="mt-1 text-white/60">{match.metadata.description}</p>
                    </li>
                  ))}
                </ol>
              </DebugBlock>

              <DebugBlock title="AI Recommendations">
                <ol className="space-y-2 text-sm leading-5">
                  {response.recommendations.map((recommendation) => (
                    <li className="rounded-md bg-white/5 p-3" key={recommendation.id}>
                      <span className="font-bold text-white">{recommendation.title}</span>
                      <p className="mt-1 text-white/70">{recommendation.ai_summary}</p>
                      <p className="mt-2 text-[#47e982]">{recommendation.ai_reason}</p>
                    </li>
                  ))}
                </ol>
              </DebugBlock>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function DebugBlock({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#47e982]">{title}</h2>
      {children}
    </div>
  );
}
