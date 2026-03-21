/**
 * Data quality validator for all ingestion pipelines.
 *
 * Partitions incoming rows into clean/quarantined based on 3 rule types:
 *   1. Geo-label mismatch  (IOM and ACLED — coordinates vs assigned route)
 *   2. Outlier coordinates (IOM and ACLED — null island, out-of-range lat/lng)
 *   3. Value anomalies     (all sources — negative counts, implausible maximums)
 *
 * Known-bad IOM records are pre-seeded in data_quarantine with status='accepted'
 * and are passed through as clean on every IOM run.
 *
 * Graceful degradation: on any DB failure, returns all rows as clean so the
 * ingestion pipeline is never blocked by the validation layer.
 *
 * Exports: validateRows, quarantineRows, SOURCE_CONFIG
 */

const { applyGeoBoundsCorrections } = require('./iomNormalizer');
const db = require('../database/connection');

// ---------------------------------------------------------------------------
// Source configuration: which rules to apply per data source
// ---------------------------------------------------------------------------

const SOURCE_CONFIG = {
  iom: {
    hasGeo: true,
    countField: null,
    maxCount: null,
    fatField: null,
    maxFat: null,
    dmField: 'dead_and_missing',
    maxDm: 10000,
  },
  acled: {
    hasGeo: true,
    countField: null,
    maxCount: null,
    fatField: 'fat',
    maxFat: 50000,
    dmField: null,
    maxDm: null,
  },
  eurostat: {
    hasGeo: false,
    countField: 'value',
    maxCount: null,
    fatField: null,
    maxFat: null,
    dmField: null,
    maxDm: null,
  },
  unhcr: {
    hasGeo: false,
    countField: 'value',
    maxCount: 5000000,
    fatField: null,
    maxFat: null,
    dmField: null,
    maxDm: null,
  },
  frontex: {
    hasGeo: false,
    countField: 'count',
    maxCount: 500000,
    fatField: null,
    maxFat: null,
    dmField: null,
    maxDm: null,
  },
  cbp: {
    hasGeo: false,
    countField: 'count',
    maxCount: 2000000,
    fatField: null,
    maxFat: null,
    dmField: null,
    maxDm: null,
  },
  'uk-channel': {
    hasGeo: false,
    countField: 'count',
    maxCount: 100000,
    fatField: null,
    maxFat: null,
    dmField: null,
    maxDm: null,
  },
};

// ---------------------------------------------------------------------------
// Rule runner — pure synchronous function, no DB dependency
// ---------------------------------------------------------------------------

/**
 * Apply all validation rules to a single row.
 * Returns an array of violations (empty = row is clean).
 *
 * @param {string} source - Source key from SOURCE_CONFIG
 * @param {Object} row    - Transformed row object
 * @param {Object} config - SOURCE_CONFIG entry for this source
 * @param {Set}    acceptedIds - Set of string IDs pre-accepted in data_quarantine
 * @returns {Array<{rule: string, expected: string, found: string, detail?: string}>}
 */
function runRules(source, row, config, acceptedIds) {
  // Suppress known-accepted IOM records — pass them through without validation
  if (source === 'iom' && row.id && acceptedIds.has(String(row.id))) {
    return [];
  }

  const violations = [];

  // ---- Rules 1 + 2: Geo rules (IOM and ACLED only) ----
  if (config.hasGeo && row.lat != null && row.lng != null) {
    // Rule 2: Outlier coordinates — null island and out-of-range values
    if (row.lat === 0 && row.lng === 0) {
      violations.push({
        rule: 'outlier-coordinates',
        expected: 'non-null-island coordinates',
        found: 'lat=0, lng=0 (null island)',
        detail: 'Coordinates (0, 0) are the null island — not a valid incident location',
      });
    } else if (row.lat < -90 || row.lat > 90 || row.lng < -180 || row.lng > 180) {
      violations.push({
        rule: 'outlier-coordinates',
        expected: 'lat in [-90,90], lng in [-180,180]',
        found: `lat=${row.lat}, lng=${row.lng}`,
        detail: 'Coordinates are outside the valid geographic range',
      });
    } else if (row.route) {
      // Rule 1: Geo-label mismatch — check whether bounds correction would reassign route
      const corrected = applyGeoBoundsCorrections(row.route, row.lat, row.lng);
      if (corrected !== row.route) {
        violations.push({
          rule: 'geo-label-mismatch',
          expected: corrected,
          found: row.route,
          detail: `coordinates (${row.lat}, ${row.lng}) fall in ${corrected} region`,
        });
      }
    }
  }

  // ---- Rule 3: Value anomalies ----

  // Count-based sources (CBP, Frontex, UK Channel, UNHCR, Eurostat)
  if (config.countField) {
    const val = parseInt(row[config.countField], 10);
    if (!isNaN(val)) {
      if (val < 0) {
        violations.push({
          rule: 'value-anomaly',
          expected: '>= 0',
          found: String(val),
          detail: `${config.countField} is negative`,
        });
      } else if (config.maxCount != null && val > config.maxCount) {
        violations.push({
          rule: 'value-anomaly',
          expected: `<= ${config.maxCount}`,
          found: String(val),
          detail: `${config.countField} exceeds plausible maximum`,
        });
      }
    }
  }

  // ACLED fatalities field
  if (config.fatField && row[config.fatField] != null) {
    const fat = parseInt(row[config.fatField], 10);
    if (!isNaN(fat)) {
      if (fat < 0) {
        violations.push({
          rule: 'value-anomaly',
          expected: '>= 0',
          found: String(fat),
          detail: 'fatalities is negative',
        });
      } else if (config.maxFat != null && fat > config.maxFat) {
        violations.push({
          rule: 'value-anomaly',
          expected: `<= ${config.maxFat}`,
          found: String(fat),
          detail: 'fatalities exceeds plausible maximum for a single event',
        });
      }
    }
  }

  // IOM dead_and_missing field
  if (config.dmField && row[config.dmField] != null) {
    const dm = parseInt(row[config.dmField], 10);
    if (!isNaN(dm)) {
      if (dm < 0) {
        violations.push({
          rule: 'value-anomaly',
          expected: '>= 0',
          found: String(dm),
          detail: 'dead_and_missing is negative',
        });
      } else if (config.maxDm != null && dm > config.maxDm) {
        violations.push({
          rule: 'value-anomaly',
          expected: `<= ${config.maxDm}`,
          found: String(dm),
          detail: 'dead_and_missing exceeds plausible maximum for a single incident',
        });
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// validateRows — main validation entry point
// ---------------------------------------------------------------------------

/**
 * Validate an array of transformed rows from a given source.
 * Returns { clean, quarantined } partition.
 *
 * On any DB or unexpected error, returns all rows as clean (graceful fallback)
 * so the ingestion pipeline is never blocked by the validation layer.
 *
 * @param {string} source - One of the SOURCE_CONFIG keys
 * @param {Array}  rows   - Array of transformed row objects
 * @returns {Promise<{ clean: Array, quarantined: Array<{row, violations}> }>}
 */
async function validateRows(source, rows) {
  try {
    const config = SOURCE_CONFIG[source] || { hasGeo: false, countField: null };
    const acceptedIds = new Set();

    // Load known-accepted IOM records to suppress them from re-flagging
    if (source === 'iom') {
      try {
        const accepted = await db('data_quarantine')
          .where({ source: 'iom', status: 'accepted' })
          .select('raw_data');
        for (const r of accepted) {
          try {
            const data = typeof r.raw_data === 'string' ? JSON.parse(r.raw_data) : r.raw_data;
            if (data && data.id) {
              acceptedIds.add(String(data.id));
            }
          } catch (_parseErr) {
            // Skip malformed raw_data entries — they won't suppress anything
          }
        }
      } catch (dbErr) {
        // DB failure loading accepted IDs — log warning but continue with empty set
        console.warn('[Validator] Could not load accepted IOM IDs, proceeding without suppression:', dbErr.message);
      }
    }

    const clean = [];
    const quarantined = [];

    for (const row of rows) {
      const violations = runRules(source, row, config, acceptedIds);
      if (violations.length > 0) {
        quarantined.push({ row, violations });
      } else {
        clean.push(row);
      }
    }

    return { clean, quarantined };
  } catch (err) {
    // Graceful fallback: validation failure must never block ingestion
    console.error('[Validator] Unexpected error in validateRows, returning all rows as clean:', err.message);
    return { clean: rows, quarantined: [] };
  }
}

// ---------------------------------------------------------------------------
// quarantineRows — write quarantined items to data_quarantine table
// ---------------------------------------------------------------------------

/**
 * Insert quarantined items into the data_quarantine table.
 *
 * @param {string} source           - Source key (e.g. 'iom', 'cbp')
 * @param {Array}  quarantinedItems - Array of { row, violations } from validateRows
 * @returns {Promise<void>}
 */
async function quarantineRows(source, quarantinedItems) {
  if (!quarantinedItems || quarantinedItems.length === 0) return;

  const rows = quarantinedItems.map(item => ({
    source,
    raw_data: JSON.stringify(item.row),
    rule_violated: item.violations.map(v => v.rule).join(', '),
    violation_detail: JSON.stringify(item.violations),
    quarantined_at: new Date().toISOString(),
    status: 'pending',
  }));

  await db('data_quarantine').insert(rows);
}

module.exports = { validateRows, quarantineRows, SOURCE_CONFIG };
