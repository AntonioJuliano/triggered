const repl = require("repl");

const dotenv = require('dotenv');
dotenv.load();

const blockImporter = require('../services/blockImporter');
const rescore = require('../tasks/rescore');
const Contract = require('../models/contract');

const envName = process.env.NODE_ENV || "dev";
const replServer = repl.start({
  prompt: "triggered (" + envName + ") > "
});

replServer.context.blockImporter = blockImporter;
replServer.context.rescore = rescore;
replServer.context.Contract = Contract;
