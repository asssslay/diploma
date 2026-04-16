/**
 * Executes async tasks sequentially with a rate limit.
 * Designed to stay under Resend's 5 rps team limit.
 */
export async function runThrottled<T>(
  tasks: Array<() => Promise<T>>,
  ratePerSecond = 4,
): Promise<T[]> {
  const results: T[] = [];
  const intervalMs = Math.ceil(1000 / ratePerSecond);
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task) continue;
    results.push(await task());
    if (i < tasks.length - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return results;
}
