require('dotenv').config();
const path = require('path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const ENV_INFO = require('./helpers/envInfo');
const dataRoutes = require('./routes/dataRoute');

const app = express();

// Printf env
console.info(ENV_INFO);
// Security
app.use(helmet());
app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));
// CORS — allow all origins (general internet traffic)
app.use(cors());
// Gzipping
app.use(compression());

// Rate limiting — 200 requests per 15-minute window per IP on /data routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Try again in 15 minutes.' },
});

// API routing
app.use('/data', apiLimiter);
app.use('/data', dataRoutes);
// Serve react app
app.use(express.static(path.join(__dirname, '../dist')));
app.use((req, res) => { res.sendFile(path.join(__dirname, '../dist/index.html')); });

if (require.main === module) {
  const cron = require('node-cron');
  const { runAcledIngestion } = require('./ingestion/acledIngestion');
  const { runUnhcrIngestion } = require('./ingestion/unhcrIngestion');
  const { runIomIngestion } = require('./ingestion/iomIngestion');
  const { runEurostatIngestion } = require('./ingestion/eurostatIngestion');
  const { runFrontexIngestion } = require('./ingestion/frontexIngestion');
  const { runCbpIngestion } = require('./ingestion/cbpIngestion');
  const { runUkChannelIngestion } = require('./ingestion/ukChannelIngestion');
  const { runWithRetry } = require('./ingestion/retryRunner');

  // Staggered schedules — Eurostat before UNHCR so seasonal ratios are available
  // All jobs wrapped with retry (3 attempts, exponential backoff) + email alert on final failure
  if (process.env.ACLED_EMAIL && process.env.ACLED_PASSWORD) {
    cron.schedule('0 2 * * 1', () => runWithRetry('acled', runAcledIngestion));              // Monday 02:00 (weekly)
  } else {
    console.log('[ACLED cron] Skipped — ACLED_EMAIL/ACLED_PASSWORD not set. Will enable when API access is granted.');
  }
  cron.schedule('0 2 * * 3', () => runWithRetry('eurostat', runEurostatIngestion));           // Wednesday 02:00 (weekly, before UNHCR)
  cron.schedule('0 2 * * 5', () => runWithRetry('iom', runIomIngestion));                    // Friday 02:00 (weekly)
  cron.schedule('0 4 * * 5', () => runWithRetry('unhcr', runUnhcrIngestion));                // Friday 04:00 (weekly, after Eurostat)
  cron.schedule('0 3 1 * *', () => runWithRetry('frontex', runFrontexIngestion));             // 1st of month 03:00
  cron.schedule('0 5 15 * *', () => runWithRetry('cbp', runCbpIngestion));                   // 15th of month 05:00 (CBP publishes ~2 months behind)
  cron.schedule('0 5 1 * *', () => runWithRetry('uk-channel', runUkChannelIngestion));       // 1st of month 05:00 (quarterly data, monthly check)

  app.listen(process.env.PORT);
}
module.exports = app;
