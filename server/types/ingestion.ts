export interface IngestionResult {
  source: string;
  rowsAffected: number;
  quarantineCount: number;
  duration: number;
  error?: string;
}

export interface IngestionLogEntry {
  source: string;
  status: 'success' | 'partial' | 'error';
  rows_affected: number;
  error_details: string | null;
}
