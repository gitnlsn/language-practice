import { requireNativeModule } from "expo";

export interface Player {
  id: string;
  name: string;
}

interface PlayGamesNative {
  /** False when this build has no Play Games project ID or the phone has no Google Play services. */
  isAvailable(): boolean;
  isAuthenticated(): Promise<boolean>;
  /** Shows Google's sign-in prompt. */
  signIn(): Promise<boolean>;
  getPlayer(): Promise<Player>;
  /** Queued: works offline and syncs later. */
  unlockAchievement(id: string): void;
  /** For incremental achievements. Idempotent: progress only goes up. */
  setAchievementSteps(id: string, steps: number): void;
  /** Rejects when offline or signed out; nothing is queued, so retry later. */
  submitScore(leaderboardId: string, score: number): Promise<void>;
  showAchievements(): Promise<void>;
  showLeaderboards(): Promise<void>;
  showLeaderboard(id: string): Promise<void>;
  /** Opens a cloud save; returns the contents of every version (conflicting copies included). */
  openSave(name: string): Promise<string[]>;
  /** Writes and closes the save opened by openSave. */
  commitSave(data: string, description: string): Promise<void>;
  closeSave(): Promise<void>;
}

export default requireNativeModule<PlayGamesNative>("PlayGames");
