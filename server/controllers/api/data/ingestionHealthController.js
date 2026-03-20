const db = require('../../../database/connection');

const SOURCES = ['acled', 'eurostat', 'iom', 'unhcr', 'frontex', 'cbp', 'uk-channel'];

// Expected freshness per source (hours)
const FRESHNESS_THRESHOLDS = {
  acled: 7 * 24,       // weekly
  eurostat: 7 * 24,    // weekly
  iom: 7 * 24,         // weekly
  unhcr: 7 * 24,       // weekly
  frontex: 32 * 24,    // monthly
  cbp: 32 * 24,        // monthly
  'uk-channel': 32 * 24, // monthly
};

async function getIngestionHealth(req, res) {
  const results = {};

  for (const source of SOURCES) {
    const lastSuccess = await db('ingestion_log')
      .where({ source, status: 'success' })
      .orderBy('completed_at', 'desc')
      .first();

    const lastError = await db('ingestion_log')
      .where({ source, status: 'error' })
      .orderBy('completed_at', 'desc')
      .first();

    const thresholdHours = FRESHNESS_THRESHOLDS[source] || 7 * 24;
    let stale = false;
    let hoursAgo = null;

    if (lastSuccess) {
      hoursAgo = Math.round((Date.now() - new Date(lastSuccess.completed_at).getTime()) / (1000 * 60 * 60));
      stale = hoursAgo > thresholdHours;
    }

    results[source] = {
      lastSuccess: lastSuccess ? lastSuccess.completed_at : null,
      lastSuccessAgo: hoursAgo !== null ? `${hoursAgo}h` : 'never',
      rowsAffected: lastSuccess ? lastSuccess.rows_affected : 0,
      stale,
      lastError: lastError ? {
        at: lastError.completed_at,
        message: lastError.error_message,
      } : null,
    };
  }

  const allHealthy = Object.values(results).every(r => r.lastSuccess && !r.stale);

  res.json({
    status: allHealthy ? 'healthy' : 'degraded',
    checked: new Date().toISOString(),
    sources: results,
  });
}

module.exports = { getIngestionHealth };
