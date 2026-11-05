// Play Games achievement and leaderboard IDs, copied from Play Console (Play Games Services → Achievements /
// Leaderboards) after you create them there. They look like "CgkI…". An empty ID is skipped, so the app runs fine
// before they're filled in. The Play Games project ID goes in app.json (the ./plugins/withPlayGames plugin).

export const ACHIEVEMENTS = {
  /** Standard: hear your first sentence. */
  firstSentence: "CgkIqfG466UZEAIQAg",
  /** Incremental, 100 steps: hear 100 sentences. */
  sentences100: "CgkIqfG466UZEAIQBA",
  /** Incremental, 1000 steps: hear 1,000 sentences. */
  sentences1000: "CgkIqfG466UZEAIQCQ",
  /** Incremental, 7 steps: practise 7 days in a row. */
  streak7: "CgkIqfG466UZEAIQBg",
  /** Incremental, 30 steps: practise 30 days in a row. */
  streak30: "CgkIqfG466UZEAIQCg",
  /** Standard: hear sentences in both French and Spanish. */
  bothLanguages: "CgkIqfG466UZEAIQBQ",
  /** Standard: hear a C1 sentence. */
  levelC1: "CgkIqfG466UZEAIQBw",
  /** Standard: hear a sentence from every topic in one language. */
  allTopics: "CgkIqfG466UZEAIQCA",
  /** Standard: save a sentence. */
  firstSave: "CgkIqfG466UZEAIQAw",
};

export const LEADERBOARDS = {
  /** Total sentences heard. */
  sentences: "CgkIqfG466UZEAIQCw",
  /** Longest run of days in a row. */
  bestStreak: "CgkIqfG466UZEAIQDA",
};

/**
 * Cloud save (Play Games Saved Games). Turn on only after enabling "Jogos salvos" in Play Console: with it off, Google
 * answers a save request by signing the player out of Play Games, which breaks achievements and leaderboards too.
 */
export const CLOUD_SAVE = true;

/** Name of the cloud save in Play Games Saved Games. */
export const SAVE_NAME = "eco-progress";
