const bugsnag = require("bugsnag");

bugsnag.register(process.env.BUGSNAG_KEY);

module.exports = bugsnag;
