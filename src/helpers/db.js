const mongoose = require('mongoose');
const logger = require('./logger');

const mongoUrl = process.env.MONGO_URL;
mongoose.Promise = require('bluebird');

const connectWithRetry = async () => {
  try {
    await mongoose.connect(mongoUrl);
    logger.info({
      at: 'db#connectWithRetry',
      message: 'Connected to mongo'
    });
  } catch (e) {
    logger.error({
      at: 'db#connectWithRetry',
      message: 'Failed to connect to mongo on startup - retrying in 1 sec',
      error: e
    });
    setTimeout(connectWithRetry, 1000);
  }
};
connectWithRetry();

module.exports = mongoose;
