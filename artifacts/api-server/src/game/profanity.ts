const BLOCKED_WORDS = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dick",
  "piss",
  "slut",
  "whore",
];

export function filterProfanity(message: string): string {
  let result = message;
  for (const word of BLOCKED_WORDS) {
    const regex = new RegExp(word.split("").join("[^a-zA-Z]*"), "gi");
    result = result.replace(regex, (match) => "*".repeat(match.length));
  }
  return result;
}
