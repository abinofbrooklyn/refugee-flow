require('dotenv').config();
const path = require('path');
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const ENV_INFO = require('./helpers/envInfo');
const dataRoutes = require('./routes/dataRoute');
const adminRoutes = require('./routes/adminRoute');

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
app.use('/admin', adminRoutes);
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

  // Staggered schedules — Eurostat before UNHCR so seasonal ratios are available
  cron.schedule('0 2 * * 1', () => runAcledIngestion().catch(err => console.error('[ACLED cron]', err.message)));           // Monday 02:00 (weekly)
  cron.schedule('0 2 * * 3', () => runEurostatIngestion().catch(err => console.error('[Eurostat cron]', err.message)));     // Wednesday 02:00 (weekly, before UNHCR)
  cron.schedule('0 2 * * 5', () => runIomIngestion().catch(err => console.error('[IOM cron]', err.message)));               // Friday 02:00 (weekly)
  cron.schedule('0 4 * * 5', () => runUnhcrIngestion().catch(err => console.error('[UNHCR cron]', err.message)));           // Friday 04:00 (weekly, after Eurostat)
  cron.schedule('0 3 1 * *', () => runFrontexIngestion().catch(err => console.error('[Frontex cron]', err.message)));       // 1st of month 03:00

  app.listen(process.env.PORT);
}
module.exports = app;
