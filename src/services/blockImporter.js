const web3 = require('../helpers/web3');
const redis = require('../helpers/redis');
const logger = require('../helpers/logger');
const producerService = require('./producerService');

const BLOCK_NUMBER_KEY = 'triggered/block_number';

// This assumes there is only one instance of triggered running at a time
// If we ever want more, we need some sort of locking or parallelization

async function startImport() {
  try {
    const redisBlockNumber = await redis.getAsync(BLOCK_NUMBER_KEY);

    const blockNumber = redisBlockNumber ? parseInt(redisBlockNumber, 10) : 0;

    logger.info({
      at: 'blockImporter#startImport',
      message: 'Starting block import',
      blockNumber: blockNumber
    });

    importBlock(blockNumber);
  } catch (e) {
    logger.error({
      at: 'blockImporter#startImport',
      message: 'Starting import failed',
      error: e.toString()
    });
    setTimeout(startImport, 1000);
  }
}

async function importBlock(blockNumber) {
  try {
    logger.info({
      at: 'blockImporter#importBlock',
      message: 'Fetching block',
      blockNumber: blockNumber
    });
    await redis.setAsync(BLOCK_NUMBER_KEY, blockNumber);

    const block = await web3.eth.getBlockAsync(blockNumber, true);

    if (block === null) {
      setTimeout( () => importBlock(blockNumber), 5000);
      return;
    }

    logger.info({
      at: 'blockImporter#importBlock',
      message: 'Importing block',
      blockNumber: blockNumber,
      numTransactions: block.transactions.length
    });

    await producerService.produce(
      producerService.producers.transaction,
      block.transactions,
      tx => tx.hash
    );

    importBlock(blockNumber + 1);
  } catch (e) {
    logger.error({
      at: 'blockImporter#importBlock',
      message: 'Importing block failed',
      blockNumber: blockNumber,
      error: e.toString()
    });
    setTimeout( () => importBlock(blockNumber), 1000);
  }
}

module.exports.startImport = startImport;
