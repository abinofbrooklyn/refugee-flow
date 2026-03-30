import { Request, Response } from 'express';
import db from '../../../database/connection';
import { IngestionLogRow } from '../../../types/knex';

const SOURCES = ['acled', 'eurostat', 'iom', 'unhcr', 'frontex', 'cbp', 'uk-channel'] as const;
type Source = typeof SOURCES[number];

// Expected freshness per source (hours)
const FRESHNESS_THRESHOLDS: Record<Source, number> = {
  acled: 7 * 24,          // weekly
  eurostat: 7 * 24,       // weekly
  iom: 7 * 24,            // weekly
  unhcr: 7 * 24,          // weekly
  frontex: 32 * 24,       // monthly
  cbp: 32 * 24,           // monthly
  'uk-channel': 32 * 24,  // monthly
};

export async function getIngestionHealth(req: Request, res: Response): Promise<void> {
  try {
    const results: Record<string, {
      lastSuccess: string | null;
      lastSuccessAgo: string;
      rowsAffected: number;
      stale: boolean;
      lastError: { at: string; message: string | null } | null;
    }> = {};

    for (const source of SOURCES) {
      const lastSuccess = await db<IngestionLogRow>('ingestion_log')
        .where({ source, status: 'success' })
        .orderBy('completed_at', 'desc')
        .first();

      const lastError = await db<IngestionLogRow>('ingestion_log')
        .where({ source, status: 'error' })
        .orderBy('completed_at', 'desc')
        .first();

      const thresholdHours = FRESHNESS_THRESHOLDS[source] || 7 * 24;
      let stale = false;
      let hoursAgo: number | null = null;

      if (lastSuccess) {
        hoursAgo = Math.round((Date.now() - new Date(lastSuccess.completed_at).getTime()) / (1000 * 60 * 60));
        stale = hoursAgo > thresholdHours;
      }

      results[source] = {
        lastSuccess: lastSuccess ? String(lastSuccess.completed_at) : null,
        lastSuccessAgo: hoursAgo !== null ? `${hoursAgo}h` : 'never',
        rowsAffected: lastSuccess ? lastSuccess.rows_affected : 0,
        stale,
        lastError: lastError ? {
          at: String(lastError.completed_at),
          message: 'Ingestion error occurred — check server logs for details',
        } : null,
      };
    }

    const allHealthy = Object.values(results).every(r => r.lastSuccess && !r.stale);

    res.json({
      status: allHealthy ? 'healthy' : 'degraded',
      checked: new Date().toISOString(),
      sources: results,
    });
  } catch (err) {
    console.error('[API error] /data/ingestion-health', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
