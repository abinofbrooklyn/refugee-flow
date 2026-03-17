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
  app.listen(process.env.PORT);
}
module.exports = app;
