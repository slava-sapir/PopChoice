"use client";

import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  MovieRecommendation,
  PersonAnswers,
  RecommendationResponse,
} from "@/lib/recommendations/types";
import { cn } from "@/lib/utils";

type Stage = "setup" | "preferences" | "loading" | "results";

type DisplayRecommendation = {
  title: string;
  poster: string;
  summary: string;
  reason: string;
  year?: number | null;
  runtimeMinutes?: number | null;
  ageRating?: string | null;
  audienceRating?: number | null;
  similarity?: number;
};

const emptyAnswers: PersonAnswers = {
  favoriteMovie: "",
  era: "",
  mood: "",
  islandPerson: "",
};

const eraOptions = ["New", "Classic"];
const moodOptions = ["Fun", "Serious", "Inspiring", "Scary"];
const loadingSteps = [
  "Reading everyone's preferences...",
  "Creating a group embedding...",
  "Searching similar movies...",
  "Writing the recommendation reason...",
];

const fallbackRecommendations: DisplayRecommendation[] = [
  {
    title: "The Martian (2015)",
    poster: "/figma-poster-martian.png",
    summary: "A smart, optimistic sci-fi adventure with tension, humor, and survival stakes.",
    reason: "This is fallback demo text used only before live AI results are loaded.",
    year: 2015,
    runtimeMinutes: 144,
    ageRating: "PG-13",
  },
  {
    title: "Rescue Dawn (2006)",
    poster: "/figma-poster-rescue-dawn.png",
    summary: "A serious survival drama with grit, danger, and a strong central performance.",
    reason: "This is fallback demo text used only before live AI results are loaded.",
    year: 2006,
    runtimeMinutes: 126,
    ageRating: "PG-13",
  },
];

function makeEmptyAnswers(count: number, current: PersonAnswers[] = []) {
  return Array.from({ length: count }, (_, index) => current[index] ?? { ...emptyAnswers });
}

function getPosterForMatch(match: MovieRecommendation, index: number) {
  const title = match.title.toLowerCase();

  if (title.includes("oppenheimer") || title.includes("top gun")) {
    return "/figma-poster-martian.png";
  }

  if (title.includes("menu") || title.includes("haunting") || title.includes("m3gan")) {
    return "/figma-poster-rescue-dawn.png";
  }

  return index % 2 === 0 ? "/figma-poster-martian.png" : "/figma-poster-rescue-dawn.png";
}

function isStrongTextAnswer(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized.length < 8) {
    return false;
  }

  return !["idk", "i dont know", "i don't know", "anything", "whatever", "no idea"].includes(normalized);
}

function toDisplayRecommendations(matches: MovieRecommendation[]): DisplayRecommendation[] {
  if (matches.length === 0) {
    return [];
  }

  return matches.map((match, index) => ({
    title: `${match.title}${match.release_year ? ` (${match.release_year})` : ""}`,
    poster: match.poster_url ?? getPosterForMatch(match, index),
    summary: match.ai_summary,
    reason: match.ai_reason,
    year: match.release_year,
    runtimeMinutes: match.runtime_minutes,
    ageRating: match.age_rating,
    audienceRating: match.audience_rating,
    similarity: match.similarity,
  }));
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("setup");
  const [peopleCount, setPeopleCount] = useState(2);
  const [watchMinutes, setWatchMinutes] = useState(120);
  const [currentPerson, setCurrentPerson] = useState(0);
  const [answers, setAnswers] = useState<PersonAnswers[]>(makeEmptyAnswers(2));
  const [activeRecommendation, setActiveRecommendation] = useState(0);
  const [recommendations, setRecommendations] = useState<DisplayRecommendation[]>(fallbackRecommendations);
  const [lastResponse, setLastResponse] = useState<RecommendationResponse | null>(null);
  const [showTrace, setShowTrace] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  const currentAnswers = answers[currentPerson] ?? emptyAnswers;
  const currentRecommendation = recommendations[activeRecommendation];

  useEffect(() => {
    if (stage !== "loading") {
      return;
    }

    const interval = window.setInterval(() => {
      setLoadingStepIndex((step) => (step + 1) % loadingSteps.length);
    }, 1300);

    return () => window.clearInterval(interval);
  }, [stage]);

  const progress = useMemo(() => {
    if (stage === "setup") {
      return 16;
    }

    if (stage === "preferences") {
      return 28 + ((currentPerson + 1) / peopleCount) * 48;
    }

    if (stage === "loading") {
      return 82;
    }

    return 78 + ((activeRecommendation + 1) / Math.max(recommendations.length, 1)) * 22;
  }, [activeRecommendation, currentPerson, peopleCount, recommendations.length, stage]);

  const validationMessage = getPersonValidationMessage(currentAnswers);
  const canSubmitPerson = validationMessage === "";

  function startPreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextCount = Math.min(Math.max(peopleCount, 1), 8);
    setPeopleCount(nextCount);
    setAnswers((current) => makeEmptyAnswers(nextCount, current));
    setCurrentPerson(0);
    setActiveRecommendation(0);
    setErrorMessage("");
    setStage("preferences");
  }

  function updateCurrentAnswer<Key extends keyof PersonAnswers>(
    key: Key,
    value: PersonAnswers[Key],
  ) {
    setAnswers((current) =>
      current.map((personAnswers, index) =>
        index === currentPerson ? { ...personAnswers, [key]: value } : personAnswers,
      ),
    );
  }

  async function continueFromPerson() {
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    if (currentPerson + 1 < peopleCount) {
      setCurrentPerson((person) => person + 1);
      return;
    }

    setErrorMessage("");
    setLoadingStepIndex(0);
    setStage("loading");

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          watchMinutes,
          people: answers,
        }),
      });

      const payload = (await response.json()) as RecommendationResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not find movie matches.");
      }

      const nextRecommendations = toDisplayRecommendations(payload.recommendations);

      if (nextRecommendations.length === 0) {
        throw new Error("No matching movies found. Try increasing the available time or changing the answers.");
      }

      setRecommendations(nextRecommendations);
      setLastResponse(payload);
      setShowTrace(false);
      setActiveRecommendation(0);
      setStage("results");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
      setStage("preferences");
    }
  }

  function resetSurvey() {
    setStage("setup");
    setPeopleCount(2);
    setWatchMinutes(120);
    setCurrentPerson(0);
    setAnswers(makeEmptyAnswers(2));
    setActiveRecommendation(0);
    setRecommendations(fallbackRecommendations);
    setLastResponse(null);
    setShowTrace(false);
    setErrorMessage("");
  }

  function editAnswers() {
    setStage("preferences");
    setCurrentPerson(0);
    setActiveRecommendation(0);
    setErrorMessage("");
    setShowTrace(false);
  }

  function goBack() {
    if (stage === "loading") {
      return;
    }

    if (stage === "results") {
      setStage("preferences");
      setCurrentPerson(peopleCount - 1);
      return;
    }

    if (stage === "preferences" && currentPerson > 0) {
      setCurrentPerson((person) => person - 1);
      return;
    }

    setStage("setup");
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[390px] items-center justify-center">
        <div className="relative flex min-h-[720px] w-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#000b3b] px-7 py-7 shadow-2xl shadow-black/70">
          {stage !== "setup" && (
            <button
              aria-label="Go back"
              className="absolute left-5 top-5 rounded-full p-1 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
              disabled={stage === "loading"}
              onClick={goBack}
              type="button"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          <Header />

          <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-[#27345f]">
            <div
              className="h-full rounded-full bg-[#47e982] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {stage === "setup" && (
            <form className="flex flex-1 flex-col justify-center gap-4" onSubmit={startPreferences}>
              <p className="rounded-md border border-[#394777] bg-[#151f46]/70 px-4 py-3 text-center text-sm leading-6 text-[#dce4ff]">
                PopChoice compares everyone&apos;s movie mood, searches our vector database, and
                uses AI to explain the picks your group is most likely to enjoy.
              </p>

              <div className="space-y-4">
                <Field label="How many people are watching?">
                  <Input
                    max={8}
                    min={1}
                    onChange={(event) => setPeopleCount(Number(event.target.value))}
                    type="number"
                    value={peopleCount}
                  />
                </Field>

                <Field label="How much time do you have?">
                  <Input
                    max={240}
                    min={30}
                    onChange={(event) => setWatchMinutes(Number(event.target.value))}
                    step={5}
                    type="number"
                    value={watchMinutes}
                  />
                </Field>
              </div>

              <Button className="mt-4 w-full" type="submit">
                Start
              </Button>
            </form>
          )}

          {stage === "preferences" && (
            <section className="flex flex-1 flex-col justify-center gap-4">
              <div className="text-center">
                <p className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-[#000b3b]">
                  {currentPerson + 1}
                </p>
              </div>

              {errorMessage && (
                <p className="rounded-sm border border-red-300/40 bg-red-950/40 px-3 py-2 text-[0.72rem] leading-4 text-red-100">
                  {errorMessage}
                </p>
              )}

              <Field label="What's your favorite movie and why?">
                <Textarea
                  className="min-h-16"
                  onChange={(event) => updateCurrentAnswer("favoriteMovie", event.target.value)}
                  value={currentAnswers.favoriteMovie}
                />
              </Field>

              <Field label="Are you in the mood for something new or a classic?">
                <ChoiceRow
                  options={eraOptions}
                  value={currentAnswers.era}
                  onChange={(value) => updateCurrentAnswer("era", value)}
                />
              </Field>

              <Field label="What are you in the mood for?">
                <ChoiceRow
                  options={moodOptions}
                  value={currentAnswers.mood}
                  onChange={(value) => updateCurrentAnswer("mood", value)}
                />
              </Field>

              <Field label="Which famous film person would you love to be stranded on an island with and why?">
                <Textarea
                  className="min-h-16"
                  onChange={(event) => updateCurrentAnswer("islandPerson", event.target.value)}
                  value={currentAnswers.islandPerson}
                />
              </Field>

              <Button
                className="mt-2 w-full"
                disabled={!canSubmitPerson}
                onClick={continueFromPerson}
                type="button"
              >
                {currentPerson + 1 === peopleCount ? "Get Movie" : "Next Person"}
              </Button>
            </section>
          )}

          {stage === "loading" && (
            <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#47e982]/30 border-t-[#47e982]" />
              <div className="space-y-2">
                <h1 className="text-xl font-semibold tracking-normal">Finding matches</h1>
                <p className="text-[0.78rem] leading-5 text-white/75">
                  {loadingSteps[loadingStepIndex]}
                </p>
              </div>
            </section>
          )}

          {stage === "results" && currentRecommendation && (
            <section className="flex flex-1 flex-col justify-center gap-4">
              <h1 className="text-center text-xl font-semibold tracking-normal">
                {currentRecommendation.title}
              </h1>

              <div className="mx-auto w-full max-w-[235px] overflow-hidden rounded-sm bg-slate-900 shadow-xl shadow-black/40">
                <Image
                  alt={`${currentRecommendation.title} poster`}
                  className="aspect-[2/3] w-full object-cover"
                  height={375}
                  priority
                  src={currentRecommendation.poster}
                  width={250}
                />
              </div>

              <div className="flex flex-wrap justify-center gap-1.5 text-[0.68rem] font-bold text-[#000b3b]">
                {currentRecommendation.year && (
                  <span className="rounded-sm bg-white px-2 py-1">
                    {currentRecommendation.year}
                  </span>
                )}
                {currentRecommendation.runtimeMinutes && (
                  <span className="rounded-sm bg-white px-2 py-1">
                    {currentRecommendation.runtimeMinutes} min
                  </span>
                )}
                {currentRecommendation.ageRating && (
                  <span className="rounded-sm bg-white px-2 py-1">
                    {currentRecommendation.ageRating}
                  </span>
                )}
                {typeof currentRecommendation.audienceRating === "number" && (
                  <span className="rounded-sm bg-white px-2 py-1">
                    {currentRecommendation.audienceRating.toFixed(1)} rating
                  </span>
                )}
              </div>

              {typeof currentRecommendation.similarity === "number" && (
                <p className="text-center text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[#47e982]">
                  Similarity {(currentRecommendation.similarity * 100).toFixed(1)}%
                </p>
              )}

              <p className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-center text-[0.68rem] leading-4 text-white/65">
                Recommendations are generated from your group answers, vector database matches,
                and an AI explanation layer. Results can vary as the movie data grows.
              </p>

              <div className="space-y-2 text-center text-[0.78rem] leading-5 text-white/85">
                <p>{currentRecommendation.summary}</p>
                <p className="rounded-sm border border-[#47e982]/25 bg-[#47e982]/10 px-3 py-2 text-left text-white">
                  <span className="mb-1 block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#47e982]">
                    Why this movie
                  </span>
                  {currentRecommendation.reason}
                </p>
              </div>

              {lastResponse && (
                <button
                  className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-white/60 transition hover:text-[#47e982]"
                  onClick={() => setShowTrace((visible) => !visible)}
                  type="button"
                >
                  {showTrace ? "Hide AI Trace" : "Show AI Trace"}
                </button>
              )}

              {showTrace && lastResponse && <AiTrace response={lastResponse} />}

              <div className="grid gap-2">
                {activeRecommendation + 1 < recommendations.length && (
                  <Button
                    className="w-full"
                    onClick={() => setActiveRecommendation((choice) => choice + 1)}
                    type="button"
                  >
                    Next Movie
                  </Button>
                )}
                <Button className="w-full" onClick={editAnswers} type="button" variant="secondary">
                  Try Another Vibe
                </Button>
                {activeRecommendation + 1 >= recommendations.length && (
                  <Button className="w-full" onClick={resetSurvey} type="button">
                    Go Again
                  </Button>
                )}
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

function getPersonValidationMessage(answers: PersonAnswers) {
  if (!isStrongTextAnswer(answers.favoriteMovie)) {
    return "Add a little more detail about a favorite movie so the embedding has a stronger signal.";
  }

  if (!answers.era.trim()) {
    return "Choose whether this person wants something new or classic.";
  }

  if (!answers.mood.trim()) {
    return "Choose a mood for this person.";
  }

  if (!isStrongTextAnswer(answers.islandPerson)) {
    return "Add a little more detail about the film person choice so PopChoice can read the vibe.";
  }

  return "";
}

function AiTrace({ response }: { response: RecommendationResponse }) {
  return (
    <div className="max-h-44 overflow-auto rounded-md border border-[#394777] bg-[#050b27] p-3 text-left text-[0.68rem] leading-4 text-white/75">
      <p className="mb-2 font-bold uppercase tracking-[0.14em] text-[#47e982]">Formatted group text</p>
      <pre className="mb-3 whitespace-pre-wrap font-sans">{response.groupPreferenceText}</pre>
      <p className="mb-2 font-bold uppercase tracking-[0.14em] text-[#47e982]">Top vector matches</p>
      <ol className="space-y-1">
        {response.matches.map((match) => (
          <li key={match.id}>
            {match.title}
            {match.release_year ? ` (${match.release_year})` : ""} - {(match.similarity * 100).toFixed(1)}%
          </li>
        ))}
      </ol>
    </div>
  );
}

function Header() {
  return (
    <header className="mb-6 pt-5 text-center">
      <Image
        alt="PopChoice logo"
        className="mx-auto mb-1 h-14 w-14 object-contain"
        height={68}
        priority
        src="/popchoice-logo.png"
        width={68}
      />
      <p className="text-lg font-bold tracking-normal">PopChoice</p>
    </header>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="block text-[0.72rem] font-medium leading-4 text-white" htmlFor={label}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function ChoiceRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {options.map((option) => {
        const selected = value === option;

        return (
          <button
            className={cn(
              "h-8 rounded-sm border px-2 text-[0.7rem] font-semibold transition",
              selected
                ? "border-[#47e982] bg-[#47e982] text-[#000b3b]"
                : "border-[#3b4772] bg-[#23305b] text-white hover:border-[#47e982]",
            )}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}