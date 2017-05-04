const Producer = require('sqs-producer');
const bluebird = require('bluebird');

function createProducer(queue_url, region) {
  const producer = Producer.create({
    queueUrl: queue_url,
    region: region
  });
  bluebird.promisifyAll(producer);
  return producer;
}

module.exports.createProducer = createProducer;
