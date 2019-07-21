const JsonStreamify = require('./streamify');
const { toJson } = require('./utils');

const toJsonStream = (object, options = {}) => {
  return new JsonStreamify(object, options);
};

const toJsonString = (object, options = {}) =>
  toJson(toJsonStream(object, options));

const toObject = (object, options = {}) =>
  toJsonString(object, options).then(jsonString => {
    return JSON.parse(jsonString);
  });

module.exports = {
  toJsonStream,
  toJson: toJsonString,
  toObject,
  JsonStreamify,
};
