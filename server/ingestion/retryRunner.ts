import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { sendIngestionAlert } from './alerter';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 30000;

/**
 * Invalidate CloudFront /data/* cache after a successful ingestion.
 * No-op in local dev (CF_DIST_ID not set). Never fails the ingestion.
 */
async function invalidateCloudFrontCache(): Promise<void> {
  const distId = process.env.CF_DIST_ID;
  if (!distId) {
    console.log('[cache] CF_DIST_ID not set — skipping CloudFront invalidation (local dev)');
    return;
  }

  try {
    const cf = new CloudFrontClient({ region: 'us-east-1' });
    await cf.send(new CreateInvalidationCommand({
      DistributionId: distId,
      InvalidationBatch: {
        CallerReference: `ingestion-${Date.now()}`,
        Paths: { Quantity: 1, Items: ['/data/*'] },
      },
    }));
    console.log('[cache] CloudFront /data/* cache invalidated');
  } catch (err) {
    // Log but don't fail the ingestion — data is in the DB, cache will expire naturally
    console.error('[cache] CloudFront invalidation failed:', (err as Error).message);
  }
}

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
      // Bust CloudFront cache so users see fresh data immediately after ingestion
      await invalidateCloudFrontCache();
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
