const producerService = require('../services/producerService');

/**
 * Object containing all the available types of tasks
 * @type {Object}
 */
const types = {
  rescore: 'RESCORE'
}

/**
 * Schedule a batch of tasks to be executed by quest. Tasks should be batch scheduled if possible
 *
 * @param  {String} type      Type of task to be executed, should be one of the types specified
 *                            above. quest must already have a handler for this task type.
 * @param  {Array} argsArray  An array of objects which are the arguments passed to the task
 *                            consumer in quest
 * @param  {Function} getId   A function mapping args to a taskId, which should be unique
 * @return {Promise}          A promise, resolved when the tasks are successfully scheduled
 */
function batchSchedule(type, argsArray, getId) {
  return producerService.produce(
    producerService.queues.task,
    argsArray.map( args => {
      return {
        type: type,
        args: args
      };
    }),
    message => getId(message.args)
  );
}

/**
 * Schedule a single task to be executed by quest
 *
 * @param  {String} type      Type of task to be executed, should be one of the types specified
 *                            above. quest must already have a handler for this task type.
 * @param  {Object} args      An object which is the arguments passed to the task
 *                            consumer in quest
 * @param  {String} id        A unique taskId
 * @return {Promise}          A promise, resolved when the task is successfully scheduled
 */
function schedule(type, args, id) {
  return producerService.produce(
    producerService.queues.task,
    [{
      type: type,
      args: args
    }],
    () => id
  );
}

module.exports.types = types;
module.exports.schedule = schedule;
module.exports.batchSchedule = batchSchedule;
