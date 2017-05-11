const schedule = require('node-schedule');
const rescore = require('../tasks/rescore');

// Runs once a day
schedule.scheduleJob({ hour: 2 }, () => rescore.rescoreAll(false));
