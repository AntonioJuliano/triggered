const sqs = require('../helpers/sqs');
const logger = require('../helpers/logger');

// Current AWS max is 10, so check before raising
const BATCH_SIZE = 10;
const MAX_RETRIES = 5;
const RETRY_TIMEOUT = 500;

const queues = {
  transaction: {
    sqs: sqs.createSqsQueue({
      region: process.env.TRANSACTION_QUEUE_REGION,
      accessKeyId: process.env.TRANSACTION_QUEUE_SECRET_ACCESS_ID,
      secretAccessKey: process.env.TRANSACTION_QUEUE_SECRET_ACCESS_KEY
    }),
    name: 'transaction',
    url: process.env.TRANSACTION_QUEUE_URL
  }
};

function delay(t) {
  return new Promise(function(resolve) {
    setTimeout(resolve, t)
  });
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

    return delay(RETRY_TIMEOUT).then(_sendBatch(batch, queue, getMessageId, i + 1));
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

    return delay(RETRY_TIMEOUT).then(_sendBatch(failedItems, queue, getMessageId, i + 1));
  }
}

async function produce(queue, items, getMessageId) {
  let batches = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batches.push(items.slice(i, Math.min(i + BATCH_SIZE, items.length)));
  }

  await batches.map( b => _sendBatch(b, queue, getMessageId, 0));
}

module.exports.queues = queues;
module.exports.produce = produce;
