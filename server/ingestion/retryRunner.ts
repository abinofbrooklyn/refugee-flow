import { sendIngestionAlert } from './alerter';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 30000;

/**
 * Run an ingestion function with retry logic and alerting on final failure.
 * Exponential backoff: 30s, 60s, 120s between attempts (0 in test).
 *
 * @param source - Source name (for logging and alerts)
 * @param fn - Async ingestion function to run
 */
export async function runWithRetry<T>(
  source: string,
  fn: () => Promise<T>
): Promise<T | undefined> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        console.log(`[${source}] Succeeded on attempt ${attempt}/${MAX_RETRIES}`);
      }
      return result;
    } catch (err) {
      lastError = err as Error;
      console.error(`[${source}] Attempt ${attempt}/${MAX_RETRIES} failed:`, lastError.message);

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[${source}] Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted — send alert
  console.error(`[${source}] All ${MAX_RETRIES} attempts failed. Sending alert.`);
  await sendIngestionAlert(source, lastError!.message, MAX_RETRIES);
  return undefined;
}
