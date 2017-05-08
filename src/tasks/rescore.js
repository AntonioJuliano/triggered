const Contract = require('../models/contract');
const logger = require('../helpers/logger');
const delay = require('../helpers/delay');
const tasks = require('./tasks');

const BATCH_SIZE = 10;
const MAX_BATCH_RETRIES = 3;

async function rescoreAll() {
  try {
    logger.info({
      at: 'rescore#rescoreAll',
      message: 'Initiating rescores'
    });

    const startTime = new Date();

    const cursor = Contract.find({}).cursor();

    // This job currently runs once a day. This gets a unique numeric id per run
    // which shoudl be always increasing
    const now = new Date();
    const runStr = `${now.getUTCFullYear()}${now.getUTCMonth() + 1 < 10 ? 0 : ''}`
                    + `${now.getMonth() + 1}${now.getUTCDate() < 10 ? 0: ''}${now.getUTCDate()}`
                    + '02';
    const runId = parseInt(runStr, 10);

    const total = await _rescoreBatches(cursor, runId);

    logger.info({
      at: 'rescore#rescoreAll',
      message: 'Finished initiating rescores',
      total: total,
      timeTaken: new Date() - startTime
    });
  } catch(e) {
    logger.error({
      at: 'rescore#rescoreAll',
      message: 'Error thrown while initiating rescoring',
      error: e.toString()
    })
  }
}

async function _rescoreBatches(cursor, runId) {
  let count = 0;
  let addresses = [];
  try {
    for (let contract = await cursor.next(); contract !== null; contract = await cursor.next()) {
      addresses.push(contract.address);
      count++;

      if (addresses.length >= BATCH_SIZE) {
        _rescoreBatch(addresses, runId).catch( e => {
          logger.error({
            at: 'contractTasks#_rescore',
            message: 'Rescoring contract batch failed',
            error: e.toString(),
            addresses: addresses
          });
        });

        addresses = [];
      }
    }
  } catch(e) {
    logger.error({
      at: 'contractTasks#_rescoreBatches',
      message: 'Getting next contract failed',
      error: e.toString(),
      addresses: addresses
    });

    return delay(1000).then(() => _rescoreBatches(cursor, runId));
  }

  if (addresses.length > 0) {
    _rescoreBatch(addresses, runId).catch( e => {
      logger.error({
        at: 'contractTasks#_rescore',
        message: 'Rescoring contract batch failed',
        error: e.toString(),
        addresses: addresses
      });
    });
  }

  return count;
}

async function _rescoreBatch(addresses, runId, attempts) {
  attempts = attempts ? attempts : 0;

  if (attempts >= MAX_BATCH_RETRIES) {
    throw new Error('Maximum retries used');
  }

  try {
    await tasks.batchSchedule(
      tasks.types.rescore,
      addresses.map( a => {
        return {
          address: a,
          type: 'contract',
          runId: runId
        };
      }),
      args => args.address + '-' + args.runId
    );
  } catch(e) {
    logger.error({
      at: 'contractTasks#_rescoreBatch',
      message: 'Rescoring contract batch failed. Retrying...',
      error: e.toString(),
      addresses: addresses
    });

    return delay(1000).then(_rescoreBatch(addresses, runId, attempts + 1));
  }
}

module.exports.rescoreAll = rescoreAll;
