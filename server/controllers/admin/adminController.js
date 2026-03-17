const { parse } = require('csv-parse/sync');
const db = require('../../database/connection');
const { logIngestion } = require('../../ingestion/ingestionLogger');
const { reduceGeoPercision } = require('../api/data/helpers/dataProcessors');
const { runAcledIngestion } = require('../../ingestion/acledIngestion');
const { runUnhcrIngestion } = require('../../ingestion/unhcrIngestion');
const { runIomIngestion } = require('../../ingestion/iomIngestion');
const { runEurostatIngestion } = require('../../ingestion/eurostatIngestion');

const ALLOWED_TARGETS = ['war_events', 'asy_applications', 'route_deaths'];
const ALLOWED_SOURCES = { acled: runAcledIngestion, unhcr: runUnhcrIngestion, iom: runIomIngestion, eurostat: runEurostatIngestion };

async function csvPreview(req, res) {
  try {
    const rows = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return res.json({ rows, count: rows.length });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

async function csvCommit(req, res) {
  const startedAt = new Date();
  const { rows, target } = req.body;

  if (!ALLOWED_TARGETS.includes(target)) {
    return res.status(400).json({ error: 'Invalid target table. Allowed: war_events, asy_applications, route_deaths' });
  }

  try {
    const processedRows = rows.map((row) => {
      const processed = { ...row };
      if (processed.lat !== undefined) {
        processed.lat = reduceGeoPercision(parseFloat(processed.lat), 2);
      }
      if (processed.lng !== undefined) {
        processed.lng = reduceGeoPercision(parseFloat(processed.lng), 2);
      }
      return processed;
    });

    const BATCH_SIZE = 500;
    for (let i = 0; i < processedRows.length; i += BATCH_SIZE) {
      const batch = processedRows.slice(i, i + BATCH_SIZE);
      await db(target).insert(batch).onConflict().ignore();
    }

    await logIngestion({ source: 'csv', status: 'success', rowsAffected: rows.length, startedAt });

    return res.json({ inserted: rows.length });
  } catch (err) {
    console.error('[csvCommit error]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function triggerIngestion(req, res) {
  const { source } = req.params;
  const runner = ALLOWED_SOURCES[source];

  if (!runner) {
    return res.status(400).json({ error: 'Unknown source. Allowed: acled, unhcr, iom, eurostat' });
  }

  try {
    await runner();
    return res.json({ status: 'complete', source });
  } catch (err) {
    return res.status(500).json({ error: err.message, source });
  }
}

module.exports = { csvPreview, csvCommit, triggerIngestion };
