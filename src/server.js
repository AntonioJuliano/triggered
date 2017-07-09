// This needs to be first
require('@risingstack/trace');

const dotenv = require('dotenv');
dotenv.load();

const express = require('express');
const logger = require('./helpers/logger');
const bugsnag = require('./helpers/bugsnag');
require('./lib/clock'); // Needed to start cron tasks
const blockImporter = require('./services/blockImporter');

const port = process.env.PORT;
const app = express();

blockImporter.initialize();
app.listen(port, error => {
  if (error) {
    logger.error({
      at: 'server#start',
      message: 'Server failed to start',
      error: error
    });
    bugsnag.notify(error);
  } else {
    logger.info({
      at: 'server#start',
      message: `server is listening on ${port}`
    });
  }
});
