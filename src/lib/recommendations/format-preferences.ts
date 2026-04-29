import type { PersonAnswers } from "./types";

export function formatGroupPreferences({
  people,
  watchMinutes,
}: {
  people: PersonAnswers[];
  watchMinutes: number;
}) {
  const formattedPeople = people
    .map((person, index) => {
      return [
        `Person ${index + 1}:`,
        `Favorite movie and why: ${person.favoriteMovie}`,
        `Era preference: ${person.era}`,
        `Mood: ${person.mood}`,
        `Film person island choice: ${person.islandPerson}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    "Group movie preferences:",
    `Available watch time: ${watchMinutes} minutes`,
    "",
    formattedPeople,
  ].join("\n");
}