import { DEFAULT_CHAT_MODEL } from "@/lib/ai/config";
import { PublicError } from "@/lib/recommendations/errors";

export function getServerEnv() {
  return {
    openAiApiKey: requireServerEnv("OPENAI_API_KEY"),
    openAiChatModel: process.env.OPENAI_CHAT_MODEL || DEFAULT_CHAT_MODEL,
    supabaseUrl: requireServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRoleKey: requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    tmdbApiKey: process.env.TMDB_API_KEY || null,
  };
}

export function requireServerEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    console.error(`Missing environment variable: ${name}`);
    throw new PublicError("Server configuration is incomplete.", 500);
  }

  return value;
}