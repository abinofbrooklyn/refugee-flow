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

  // Staggered weekly schedules at 02:00 server time
  cron.schedule('0 2 * * 1', () => runAcledIngestion().catch(err => console.error('[ACLED cron]', err.message)));       // Monday
  cron.schedule('0 2 * * 3', () => runUnhcrIngestion().catch(err => console.error('[UNHCR cron]', err.message)));       // Wednesday
  cron.schedule('0 2 * * 5', () => runIomIngestion().catch(err => console.error('[IOM cron]', err.message)));           // Friday
  cron.schedule('0 4 * * 6', () => runEurostatIngestion().catch(err => console.error('[Eurostat cron]', err.message))); // Saturday 04:00 (longer run)

  app.listen(process.env.PORT);
}
module.exports = app;
