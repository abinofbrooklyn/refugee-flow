import { Resend } from 'resend';

// Read at call time (not import time) so tests can set env vars
const getAlertEmail = () => process.env.ALERT_EMAIL || '';
const getFromEmail = () => process.env.FROM_EMAIL || '';

interface SourceInfo {
  name: string;
  url?: string;
  dataType?: string;
  commonCauses?: string[];
  fixes?: string[];
}

interface QuarantinedItem {
  row: Record<string, unknown>;
  violations: Array<{
    rule: string;
    expected: string;
    found: string;
    detail?: string;
  }>;
}

// Source descriptions for diagnostic context
const SOURCE_INFO: Record<string, SourceInfo> = {
  acled: {
    name: 'ACLED (War/Conflict)',
    url: 'https://acleddata.com',
    dataType: 'War events and fatalities for the globe visualization',
    commonCauses: [
      'ACLED API access not yet granted (email sent to access@acleddata.com)',
      'OAuth token expired or credentials changed',
      'ACLED API rate limit exceeded',
      'Network timeout — ACLED servers occasionally slow',
    ],
    fixes: [
      'Check ACLED_EMAIL and ACLED_PASSWORD env vars are set',
      'Verify API access at https://acleddata.com/data-export-tool/',
      'Check ingestion_log table for previous error messages',
    ],
  },
  eurostat: {
    name: 'Eurostat (EU Asylum)',
    url: 'https://ec.europa.eu/eurostat',
    dataType: 'EU/EEA asylum application quarterly data + seasonal ratios for UNHCR',
    commonCauses: [
      'Eurostat API schema changed (JSON-stat format versioning)',
      'Eurostat server maintenance (usually weekends)',
      'Network timeout — large dataset download',
    ],
    fixes: [
      'Check https://ec.europa.eu/eurostat/api/ for API status',
      'IMPORTANT: UNHCR ingestion depends on Eurostat seasonal ratios — if Eurostat fails, UNHCR quarterly estimates will use fallback even distribution',
      'Re-run manually: require the module and call runEurostatIngestion()',
    ],
  },
  iom: {
    name: 'IOM (Missing Migrants)',
    url: 'https://missingmigrants.iom.int',
    dataType: 'Route death/missing data for the route map',
    commonCauses: [
      'IOM CSV download URL changed',
      'CSV format/columns changed',
      'Network timeout — full CSV download each time',
    ],
    fixes: [
      'Check https://missingmigrants.iom.int/downloads for current CSV URL',
      'Verify CSV has expected columns (Main ID, Region of Incident, etc.)',
    ],
  },
  unhcr: {
    name: 'UNHCR (Non-EU Asylum)',
    url: 'https://api.unhcr.org',
    dataType: 'Non-EU/EEA asylum application data',
    commonCauses: [
      'UNHCR API pagination changed',
      'Eurostat seasonal ratios unavailable (Eurostat may have failed earlier)',
      'API response format changed',
    ],
    fixes: [
      'Check if Eurostat ran successfully this week (UNHCR depends on it)',
      'Verify UNHCR API at https://api.unhcr.org/population/v1/asylum-applications/',
    ],
  },
  frontex: {
    name: 'Frontex (EU Border Crossings)',
    url: 'https://frontex.europa.eu',
    dataType: 'Illegal border crossing detections by route and nationality',
    commonCauses: [
      'Frontex XLSX download URL changed (dynamic hash in URL)',
      'XLSX sheet name or format changed',
      'Frontex website restructured',
    ],
    fixes: [
      'Check https://frontex.europa.eu/along-eu-borders/migratory-map/ for current data link',
      'Verify XLSX has sheet "Data" with expected columns',
    ],
  },
  cbp: {
    name: 'CBP (Americas Border)',
    url: 'https://www.cbp.gov/document/stats/nationwide-encounters',
    dataType: 'U.S. border encounter data for Americas route',
    commonCauses: [
      'CBP changed CSV URL directory structure (tries 9 URL patterns)',
      'CBP delayed publishing beyond 2-month lag',
      'CSV format or column names changed',
      'CBP website blocked automated downloads',
    ],
    fixes: [
      'Download CSV manually from https://www.cbp.gov/document/stats/nationwide-encounters',
      'Run standalone: node scripts/ingestCBP.js <path-to-csv>',
      'Check if CSV has "Fiscal Year" header in first row',
    ],
  },
  'uk-channel': {
    name: 'UK Home Office (English Channel)',
    url: 'https://www.gov.uk/government/statistical-data-sets/immigration-system-statistics-data-tables',
    dataType: 'Small boat crossing data for English Channel route',
    commonCauses: [
      'GOV.UK page restructured — XLSX link regex no longer matches',
      'XLSX sheet "Data_IER_D01" renamed',
      'UK Home Office delayed quarterly publication',
    ],
    fixes: [
      'Check the GOV.UK page for the current XLSX download link',
      'Run standalone: node scripts/ingestUKChannel.js <path-to-xlsx>',
      'Verify XLSX has sheet "Data_IER_D01"',
    ],
  },
};

/**
 * Send an alert email when an ingestion pipeline fails after all retries.
 */
export async function sendIngestionAlert(source: string, errorMessage: string, attemptCount: number): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[Alert] RESEND_API_KEY not set — cannot send failure alert for', source);
    return;
  }

  const info: SourceInfo = SOURCE_INFO[source] || { name: source, commonCauses: [], fixes: [] };
  const timestamp = new Date().toISOString();

  const html = `
    <h2 style="color: #c0392b;">Ingestion Failed: ${info.name}</h2>
    <p><strong>Source:</strong> ${source}</p>
    <p><strong>Time:</strong> ${timestamp}</p>
    <p><strong>Attempts:</strong> ${attemptCount} (all failed)</p>
    <p><strong>Error:</strong></p>
    <pre style="background: #f8f8f8; padding: 12px; border-radius: 4px; overflow-x: auto;">${errorMessage}</pre>

    <h3>What This Affects</h3>
    <p>${info.dataType || 'Unknown data type'}</p>
    <p>The app will continue showing the last successfully ingested data until this is resolved.</p>

    <h3>Probable Causes</h3>
    <ul>${(info.commonCauses || []).map(c => `<li>${c}</li>`).join('')}</ul>

    <h3>How to Fix</h3>
    <ul>${(info.fixes || []).map(f => `<li>${f}</li>`).join('')}</ul>

    <h3>Check Status</h3>
    <p>Health endpoint: <code>GET /data/ingestion-health</code></p>
    <p>Ingestion log: <code>SELECT * FROM ingestion_log WHERE source = '${source}' ORDER BY completed_at DESC LIMIT 5;</code></p>

    <hr>
    <p style="color: #888; font-size: 12px;">Refugee Flow Automated Alert</p>
  `;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: getFromEmail(),
      to: getAlertEmail(),
      subject: `[Refugee Flow] Ingestion Failed: ${info.name}`,
      html,
    });
    console.log(`[Alert] Failure email sent for ${source}`);
  } catch (err) {
    console.error(`[Alert] Failed to send email for ${source}:`, (err as Error).message);
  }
}

export async function sendQuarantineAlert(source: string, quarantinedItems: QuarantinedItem[]): Promise<void> {
  if (!quarantinedItems.length) return;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[Alert] RESEND_API_KEY not set — cannot send quarantine alert for', source);
    return;
  }

  const info: SourceInfo = SOURCE_INFO[source] || { name: source };
  const rowsHtml = quarantinedItems.map(item => `
    <tr>
      <td>${item.violations.map(v => v.rule).join(', ')}</td>
      <td><pre style="margin:0; white-space:pre-wrap; max-width:400px;">${JSON.stringify(item.row, null, 2)}</pre></td>
      <td>${item.violations.map(v => `<strong>${v.rule}:</strong> Expected: ${v.expected} / Found: ${v.found}${v.detail ? ' — ' + v.detail : ''}`).join('<br>')}</td>
    </tr>
  `).join('');

  const html = `
    <h2 style="color: #e67e22;">Data Quality Alert: ${info.name || source}</h2>
    <p><strong>${quarantinedItems.length}</strong> row(s) quarantined during ingestion.</p>
    <table border="1" cellpadding="6" style="border-collapse:collapse; font-family: monospace; font-size: 12px;">
      <thead><tr><th>Rule Violated</th><th>Raw Row Data</th><th>Detail (Expected vs Found)</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p style="margin-top:16px;">Quarantined rows are in <code>data_quarantine</code> table with status='pending'.</p>
    <p>Review: <code>SELECT * FROM data_quarantine WHERE source='${source}' AND status='pending' ORDER BY quarantined_at DESC;</code></p>
    <hr>
    <p style="color: #888; font-size: 12px;">Refugee Flow Data Quality Alert</p>
  `;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: getFromEmail(),
      to: getAlertEmail(),
      subject: `[Refugee Flow] Data Quality: ${quarantinedItems.length} rows quarantined from ${info.name || source}`,
      html,
    });
    console.log(`[Alert] Quarantine email sent for ${source} (${quarantinedItems.length} rows)`);
  } catch (err) {
    console.error(`[Alert] Failed to send quarantine email for ${source}:`, (err as Error).message);
  }
}
