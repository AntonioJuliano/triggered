const web3 = require('../helpers/web3');
const redis = require('../helpers/redis');
const logger = require('../helpers/logger');
const producerService = require('./producerService');
const delay = require('../helpers/delay');

const BLOCK_NUMBER_KEY = 'triggered/block_number';
const IMPORT_BATCH_SIZE = parseInt(process.env.BLOCK_IMPORT_BATCH_SIZE);

// This assumes there is only one instance of triggered running at a time
// If we ever want more, we need some sort of locking or parallelization

async function startImport() {
  try {
    const redisBlockNumber = await redis.getAsync(BLOCK_NUMBER_KEY);

    const blockNumber = redisBlockNumber ?
      parseInt(redisBlockNumber, 10) :
      parseInt(process.env.START_BLOCK, 10);

    logger.info({
      at: 'blockImporter#startImport',
      message: 'Starting block import',
      blockNumber: blockNumber
    });

    _batchImportBlocks(blockNumber, IMPORT_BATCH_SIZE);
  } catch (e) {
    logger.error({
      at: 'blockImporter#startImport',
      message: 'Starting import failed',
      error: e.toString()
    });
    setTimeout(startImport, 1000);
  }
}

/**
 * Import a batch of blocks starting at a block number. It is possible this
 * could fail in a state where only some of the blocks are imported, which
 * could cause blocks to be imported twice. This is currently fine, but should
 * be known in the future
 *
 * @param  {Number} startBlockNumber block number to start the import (inclusive)
 * @param  {Number} numBlocks        number of blocks to include in the batch
 * @return {Promise}                 Promise indicating succcess or failure
 */
async function _batchImportBlocks(startBlockNumber, numBlocks) {
  try {
    await redis.setAsync(BLOCK_NUMBER_KEY, startBlockNumber);
    // An array [0...numBlocks]
    const offsets = Array.from(Array(numBlocks).keys());
    await Promise.all(offsets.map( i => _importBlock(startBlockNumber + i)));
    setTimeout( () => _batchImportBlocks(startBlockNumber + numBlocks, numBlocks), 1000);
  } catch (e) {
    logger.error({
      at: 'blockImporter#_batchImportBlocks',
      message: 'Batch importing blocks failed',
      startBlockNumber: startBlockNumber,
      error: e.toString()
    });
    setTimeout( () => _batchImportBlocks(startBlockNumber, numBlocks), 1000);
  }
}

async function _importBlock(blockNumber) {
  try {
    const block = await web3.eth.getBlockAsync(blockNumber, true);

    if (block === null) {
      return delay(5000).then(() => _importBlock(blockNumber));
    }

    logger.info({
      at: 'blockImporter#_importBlock',
      message: 'Importing block',
      blockNumber: blockNumber,
      numTransactions: block.transactions.length
    });

    await producerService.produce(
      producerService.queues.transaction,
      block.transactions,
      tx => tx.hash
    );
  } catch (e) {
    logger.error({
      at: 'blockImporter#_importBlock',
      message: 'Importing block failed',
      blockNumber: blockNumber,
      error: e.toString()
    });
    return delay(1000).then(() => _importBlock(blockNumber));
  }
}

module.exports.startImport = startImport;
