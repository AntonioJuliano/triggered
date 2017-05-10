const sqs = require('../helpers/sqs');
const logger = require('../helpers/logger');
const delay = require('../helpers/delay');

// Current AWS max is 10, so check before raising
const BATCH_SIZE = 10;
const MAX_RETRIES = 5;
const RETRY_TIMEOUT = 500;

/**
 * Object containing all available queues to send to
 * @type {Object}
 */
const queues = {
  transaction: {
    sqs: sqs.createSqsQueue({
      region: process.env.TRANSACTION_QUEUE_REGION,
      accessKeyId: process.env.TRANSACTION_QUEUE_ID,
      secretAccessKey: process.env.TRANSACTION_QUEUE_KEY
    }),
    name: 'transaction',
    url: process.env.TRANSACTION_QUEUE_URL
  },
  tasks: {
    sqs: sqs.createSqsQueue({
      region: process.env.TASKS_QUEUE_REGION,
      accessKeyId: process.env.TASKS_QUEUE_ID,
      secretAccessKey: process.env.TASKS_QUEUE_KEY
    }),
    name: 'tasks',
    url: process.env.TASKS_QUEUE_URL
  }
};

/**
 * Produce a batch of items to the specified queue
 *
 * @param  {Object} queue          The queue to send to. Must be one of the queues specified above
 * @param  {Array} items           Array of objects to publish to the queue
 * @param  {Function} getMessageId Function mapping an item to a unique messageId
 * @return {Promise}               A promise resolved when messages are successfully published
 */
function produce(queue, items, getMessageId) {
  let batches = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, Math.min(i + BATCH_SIZE, items.length)));
  }

  return Promise.all(batches.map( b => _sendBatch(b, queue, getMessageId, 0)));
}

async function _sendBatch(batch, queue, getMessageId, i) {
  if (i >= MAX_RETRIES) {
    throw new Error('Maximum retries used');
  }

  let sendResult;
  try {
    // logger.debug({
    //   at: 'producerService#_sendBatch',
    //   message: 'Sending batch to sqs',
    //   attempt: i,
    //   queue: queue.name,
    //   batchIds: batch.map( item => getMessageId(item))
    // });

    sendResult = await queue.sqs.sendMessageBatchAsync({
      Entries: batch.map( item => {
        return {
          Id: getMessageId(item),
          MessageBody: JSON.stringify(item)
        }
      }),
      QueueUrl: queue.url
    });
  } catch (e) {
    logger.error({
      at: 'producerService#_sendBatch',
      message: 'Sending batch to sqs failed',
      attempt: i,
      queue: queue.name,
      batchIds: batch.map( item => getMessageId(item)),
      error: e.toString()
    });

    return delay(RETRY_TIMEOUT).then(() => _sendBatch(batch, queue, getMessageId, i + 1));
  }

  if (sendResult.Failed && sendResult.Failed.length > 0) {
    let failedItems = sendResult.Failed.map(
      r => batch.find( item => getMessageId(item) === r.Id)
    );
    if (failedItems.length !== sendResult.Failed.length) {
      throw new Error('Could not find all failed items');
    }

    logger.error({
      at: 'producerService#_sendBatch',
      message: 'Sending batch partially failed',
      attempt: i,
      queue: queue.name,
      batchIds: batch.map( item => getMessageId(item)),
      failedBatchIds: failedItems.map( item => getMessageId(item)),
      failureMessages: sendResult.Failed.map( r => r.Message)
    });

    return delay(RETRY_TIMEOUT).then(() => _sendBatch(failedItems, queue, getMessageId, i + 1));
  }
}

module.exports.queues = queues;
module.exports.produce = produce;
