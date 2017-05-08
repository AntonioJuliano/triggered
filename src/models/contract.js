const mongoose = require('../helpers/db');
const bluebird = require('bluebird');
const Schema = mongoose.Schema;

// TODO validate no duplicate tags
const tagSchema = new Schema({
  tag: {
    type: String,
    es_indexed: true,
    es_type: 'text'
  },
  approved: { type: Boolean, es_index: 'true', es_type: 'boolean', default: false }
});


const scoreSchema = new Schema({
  value: {
    type: Number,
    default: 0,
    es_indexed: true
  },
  lastRescoreId: {
    type: Number,
    default: 0
  },
  version: {
    type: Number,
    default: 1
  }
});
const contractSchema = new Schema({
  name: { type: String, es_indexed: true, es_type: 'text' },
  address: {
    type: String,
    es_indexed: true,
    es_type: 'keyword',
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true
  },
  source: String,
  sourceType: String,
  sourceVersion: String,
  optimized: Boolean,
  abi: [Schema.Types.Mixed],
  tags: {
    type: [tagSchema],
    es_indexed: true,
    es_type: 'nested',
    es_include_in_parent: true
  },
  libraries: Schema.Types.Mixed,
  description: {
    type: String,
    es_indexed: true,
    es_type: 'text'
  },
  pendingDescriptions: {
    type: [String]
  },
  link: {
    type: String,
    es_indexed: true,
    es_type: 'text'
  },
  pendingLinks: {
    type: [String]
  },
  pendingMetadata: {
    type: Boolean,
    index: true,
    default: false
  },
  score: {
    type: scoreSchema,
    es_indexed: true,
    es_type: 'nested',
    es_include_in_parent: true,
    default: {
      value: 0,
      lastRescoreId: 0,
      version: 1
    }
  }
});

const Contract = mongoose.model('Contract', contractSchema);
bluebird.promisifyAll(Contract);

module.exports = Contract;
