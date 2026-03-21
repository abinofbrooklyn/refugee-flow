import db from '../database/connection';
import { IngestionLogEntry } from '../types/ingestion';

interface LogIngestionParams {
  source: string;
  status: 'success' | 'partial' | 'error';
  rowsAffected?: number;
  errorMessage?: string | null;
  startedAt: Date;
  quarantineCount?: number;
}

export async function logIngestion({
  source,
  status,
  rowsAffected = 0,
  errorMessage = null,
  startedAt,
  quarantineCount = 0,
}: LogIngestionParams): Promise<void> {
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

export async function getLastSyncDate(source: string): Promise<Date | null> {
  const row = await db('ingestion_log')
    .where({ source, status: 'success' })
    .orderBy('completed_at', 'desc')
    .first();
  return row ? new Date(row.completed_at) : null;
}

// Re-export IngestionLogEntry for modules that import it from here
export type { IngestionLogEntry };
