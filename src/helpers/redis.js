const redis = require("redis");
const bluebird = require('bluebird');
const logger = require('./logger');

const client = redis.createClient({
  url: process.env.REDIS_URL,
  retry_strategy: ({attempt, error}) => {
    logger.error({
      at: 'redis#connect',
      message: 'Connecting to redis failed',
      error: error ? error.code : 'unknown',
      attempts: attempt
    });

    return 5000;
  }
});

bluebird.promisifyAll(client);

module.exports = client;
