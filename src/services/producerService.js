const sqs = require('../helpers/sqs');

const producers = {
  transaction: sqs.createProducer({
    queueUrl: process.env.TRANSACTION_QUEUE_URL,
    region: process.env.TRANSACTION_QUEUE_REGION
  })
};

async function produce(producer, items, getMessageId) {
  await producer.sendAsync(
    items.map( item => {
      return {
        id: getMessageId(item),
        body: JSON.stringify(item)
      }
    })
  );
}

module.exports.producers = producers;
module.exports.produce = produce;
