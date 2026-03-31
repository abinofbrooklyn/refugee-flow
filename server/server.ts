import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import express, { Express } from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import ENV_INFO from './helpers/envInfo';
import dataRoutes from './routes/dataRoute';

const app: Express = express();

// Trust CloudFront proxy — required for correct req.ip and rate limiting
// Without this, express-rate-limit sees all requests as coming from CloudFront's edge IP
app.set('trust proxy', 1);

// Printf env
console.info(ENV_INFO);
// Security — Helmet v8 with CSP for MapLibre/CartoCDN/Google Fonts
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://*.basemaps.cartocdn.com', 'https://*.cartocdn.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://*.basemaps.cartocdn.com', 'https://*.cartocdn.com'],
      workerSrc: ["'self'", 'blob:'],
      childSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginEmbedderPolicy: false,
}));
// CORS — allow all origins, GET/HEAD only (POST/PUT/DELETE blocked for cross-origin browsers)
app.use(cors({
  origin: '*',
  methods: ['GET', 'HEAD'],
}));
// Gzipping
app.use(compression());

// Rate limiting — 300 requests per 15-minute window per IP on /data routes
// (museum kiosk: single IP for many sequential visitors, 6 endpoints x 50 visitors = 300)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cron = require('node-cron');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runAcledIngestion } = require('./ingestion/acledIngestion');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runUnhcrIngestion } = require('./ingestion/unhcrIngestion');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runIomIngestion } = require('./ingestion/iomIngestion');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runEurostatIngestion } = require('./ingestion/eurostatIngestion');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runFrontexIngestion } = require('./ingestion/frontexIngestion');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runCbpIngestion } = require('./ingestion/cbpIngestion');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runUkChannelIngestion } = require('./ingestion/ukChannelIngestion');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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

export = app;
