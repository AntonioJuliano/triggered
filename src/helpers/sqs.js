const AWS = require('aws-sdk');
const bluebird = require('bluebird');

function createSqsQueue({ region, accessKeyId, secretAccessKey }) {
  const sqs = new AWS.SQS({
    region: region,
    secretAccessKey: secretAccessKey,
    accessKeyId: accessKeyId,
    maxRetries: 4,
    apiVersion: '2012-11-05'
  });
  bluebird.promisifyAll(sqs);
  return sqs;
}

module.exports.createSqsQueue = createSqsQueue;
