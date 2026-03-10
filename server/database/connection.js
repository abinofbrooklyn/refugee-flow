const mongoose = require('mongoose');
const { database } = require('../../config.js');

let connection;

if (!database.connection) {
  console.warn('No database connection string configured — running without DB. Notes feature disabled.');
  connection = Promise.resolve();
} else {
  mongoose.connect(database.connection, { useNewUrlParser: true });
  const db = mongoose.connection;

  connection = new Promise((resolve, reject) => {
    db.on('error', (err) => {
      console.warn('err', err);
      reject(err);
    });

    db.once('open', () => {
      console.info('connected w/ db');
      resolve();
    });
  });
}

module.exports = connection;
