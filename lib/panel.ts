/**
 * Panel domain logic and helper utilities.
 */

export interface SurveyData {
  asker: `0x${string}`;
  reward: bigint;
  maxResponses: number;
  responses: number;
  closesAt: bigint;
  optionCount: number;
  reclaimed: boolean;
  question: string;
}

export type SurveyStatus = "open" | "full" | "closed" | "reclaimed";

/**
 * Computes required budget to fund a survey up front: reward * maxResponses.
 */
export function totalCost(reward: bigint, maxResponses: number): bigint {
  if (reward <= 0n || maxResponses <= 0) return 0n;
  return reward * BigInt(maxResponses);
}

/**
 * Computes percentage share (0 to 100) for each option tally.
 * Returns array of numbers between 0 and 100 rounded to 1 decimal place.
 */
export function share(tallies: readonly number[] | number[]): number[] {
  if (!tallies || tallies.length === 0) return [];
  const total = tallies.reduce((sum, n) => sum + n, 0);
  if (total === 0) {
    return tallies.map(() => 0);
  }
  return tallies.map((n) => Math.round((n / total) * 1000) / 10);
}

/**
 * Returns remaining unpaid response spots available in the survey.
 */
export function remaining(survey: { maxResponses: number; responses: number }): number {
  if (!survey) return 0;
  return Math.max(0, survey.maxResponses - survey.responses);
}

/**
 * Derives current survey status.
 */
export function statusOf(
  survey: {
    closesAt: bigint | number;
    responses: number;
    maxResponses: number;
    reclaimed?: boolean;
  },
  nowSecs = Math.floor(Date.now() / 1000)
): SurveyStatus {
  if (!survey) return "closed";
  if (survey.reclaimed) return "reclaimed";
  if (survey.responses >= survey.maxResponses) return "full";
  if (Number(survey.closesAt) <= nowSecs) return "closed";
  return "open";
}

/**
 * Formats time remaining before closesAt as human readable string.
 */
export function closesIn(closesAtSecs: number | bigint, nowSecs = Math.floor(Date.now() / 1000)): string {
  const target = Number(closesAtSecs);
  const diff = target - nowSecs;

  if (diff <= 0) return "Closed";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  if (days > 0) {
    return hours > 0 ? `Closes in ${days}d ${hours}h` : `Closes in ${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `Closes in ${hours}h ${minutes}m` : `Closes in ${hours}h`;
  }
  if (minutes > 0) {
    return `Closes in ${minutes}m`;
  }
  return `Closes in ${seconds}s`;
}

/**
 * Formats seconds into clean preset label.
 */
export function formatDuration(seconds: number): string {
  if (seconds >= 86400) {
    const days = Math.round(seconds / 86400);
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (seconds >= 3600) {
    const hours = Math.round(seconds / 3600);
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${seconds}s`;
}
