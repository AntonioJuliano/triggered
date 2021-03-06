const web3 = require('../helpers/web3');
const redis = require('../helpers/redis');
const logger = require('../helpers/logger');
const producerService = require('./producerService');
const delay = require('../helpers/delay');
const bugsnag = require('../helpers/bugsnag');

const BLOCK_NUMBER_KEY = 'triggered/block_number';
const IMPORT_BATCH_SIZE = parseInt(process.env.BLOCK_IMPORT_BATCH_SIZE);

const txImports = [
  {
    name: 'default',
    blockNumberKey: BLOCK_NUMBER_KEY,
    defaultStartBlock: parseInt(process.env.START_BLOCK, 10),
    batchSize: IMPORT_BATCH_SIZE,
    acceptFunc: () => true,
    doNotCount: false,
    stop: () => false,
    nextBatchTimeout: 1000
  }
]

function initialize() {
  txImports.forEach( i => _startImport(i));
}

// This assumes there is only one instance of triggered running at a time
// If we ever want more, we need some sort of locking or parallelization
async function _startImport(txImport) {
  try {
    const redisBlockNumber = await redis.getAsync(txImport.blockNumberKey);

    const blockNumber = redisBlockNumber ?
      parseInt(redisBlockNumber, 10) :
      txImport.defaultStartBlock;

    logger.info({
      at: 'blockImporter#startImport',
      message: 'Starting block import',
      blockNumber: blockNumber,
      name: txImport.name
    });

    _batchImportBlocks(blockNumber, txImport);
  } catch (e) {
    logger.error({
      at: 'blockImporter#startImport',
      message: 'Starting import failed',
      error: e.toString()
    });
    bugsnag.notify(e);
    setTimeout(() => _startImport(txImport), 1000);
  }
}

/**
 * Import a batch of blocks starting at a block number. It is possible this
 * could fail in a state where only some of the blocks are imported, which
 * could cause blocks to be imported twice. This is currently fine, but should
 * be known in the future
 *
 * @param  {Number} startBlockNumber block number to start the import (inclusive)
 * @param  {Object} txImport         object containing information about the transactions to import
 * @return {Promise}                 Promise indicating succcess or failure
 */
async function _batchImportBlocks(startBlockNumber, txImport) {
  try {
    await redis.setAsync(txImport.blockNumberKey, startBlockNumber);
    // An array [0...numBlocks]
    const offsets = Array.from(Array(txImport.batchSize).keys());
    await Promise.all(offsets.map( i => _importBlock(startBlockNumber + i, txImport)));

    if (await txImport.stop(startBlockNumber + txImport.batchSize)) {
      logger.info({
        at: 'blockImporter#_batchImportBlocks',
        message: 'Finished block import',
        name: txImport.name,
        blockNumber: startBlockNumber + txImport.batchSize
      });
      return;
    }

    setTimeout(
      () => _batchImportBlocks(startBlockNumber + txImport.batchSize, txImport),
      txImport.nextBatchTimeout
    );
  } catch (e) {
    logger.error({
      at: 'blockImporter#_batchImportBlocks',
      message: 'Batch importing blocks failed',
      startBlockNumber: startBlockNumber,
      error: e.toString(),
      name: txImport.name
    });
    bugsnag.notify(e);
    setTimeout(
      () => _batchImportBlocks(startBlockNumber, txImport), txImport.nextBatchTimeout
    );
  }
}

async function _importBlock(blockNumber, txImport, retries) {
  try {
    const block = await web3.eth.getBlockAsync(blockNumber, true);

    if (block === null) {
      return delay(5000).then(() => _importBlock(blockNumber, txImport));
    }

    logger.info({
      at: 'blockImporter#_importBlock',
      message: 'Importing block',
      blockNumber: blockNumber,
      numTransactions: block.transactions.length,
      name: txImport.name
    });

    const txs = block.transactions.filter(txImport.acceptFunc);

    await producerService.produce(
      producerService.queues.transaction,
      txs.map( tx => {
        tx.doNotCount = txImport.doNotCount;
        tx.input = null; // For now we don't need this, and it's sometimes really big
        return tx;
      }),
      tx => tx.hash
    );
  } catch (e) {
    logger.error({
      at: 'blockImporter#_importBlock',
      message: 'Importing block failed',
      blockNumber: blockNumber,
      error: e.toString(),
      name: txImport.name
    });
    if (!retries) {
      retries = 0;
    }
    if (retries >= 3) {
      logger.error({
        at: 'blockImporter#_importBlock',
        message: 'Importing block failed permanantly',
        blockNumber: blockNumber,
        error: e.toString(),
        name: txImport.name
      });
      return;
    }
    return delay(1000).then(() => _importBlock(blockNumber, txImport, retries + 1));
  }
}

module.exports.initialize = initialize;
