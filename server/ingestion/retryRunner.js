const { sendIngestionAlert } = require('./alerter');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 30000;

/**
 * Run an ingestion function with retry logic and alerting on final failure.
 * Exponential backoff: 30s, 60s, 120s between attempts (0 in test).
 *
 * @param {string} source - Source name (for logging and alerts)
 * @param {Function} fn - Async ingestion function to run
 */
async function runWithRetry(source, fn) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await fn();
      if (attempt > 1) {
        console.log(`[${source}] Succeeded on attempt ${attempt}/${MAX_RETRIES}`);
      }
      return; // success
    } catch (err) {
      lastError = err;
      console.error(`[${source}] Attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[${source}] Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted — send alert
  console.error(`[${source}] All ${MAX_RETRIES} attempts failed. Sending alert.`);
  await sendIngestionAlert(source, lastError.message, MAX_RETRIES);
}

module.exports = { runWithRetry };
