const db = require('../database/connection');

async function logIngestion({ source, status, rowsAffected = 0, errorMessage = null, startedAt, quarantineCount = 0 }) {
  await db('ingestion_log').insert({
    source,
    status,
    rows_affected: rowsAffected,
    error_message: errorMessage,
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
    quarantine_count: quarantineCount,
  });
}

async function getLastSyncDate(source) {
  const row = await db('ingestion_log')
    .where({ source, status: 'success' })
    .orderBy('completed_at', 'desc')
    .first();
  return row ? new Date(row.completed_at) : null;
}

module.exports = { logIngestion, getLastSyncDate };
