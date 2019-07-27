// const intoStream = require('into-stream');
const { Readable, Writable } = require('stream');
const devNullStream = () =>
  Writable({
    write(chunk, encoding, done) {
      setImmediate(done);
    },
  });

const toGenericStream = valueToBeStream => {
  if (valueToBeStream.next instanceof Function) {
    return generatorToStream(valueToBeStream);
  } else if (typeof valueToBeStream === 'string') {
    return intoStream(valueToBeStream.split(''), { objectMode: false });
    // return intoStream(valueToBeStream);
  } else {
    return intoStream(valueToBeStream, { objectMode: true });
  }
};

const toStream = (value, jsonType) => {
  const stream = toGenericStream(value);
  stream.jsonType = jsonType;
  return stream;
};

const intoStream = (obj, options) => {
  const values = Array.isArray(obj) ? obj : [obj];
  const stream = new Readable({
    ...options,
    read() {
      if (values.length) {
        setImmediate(() => this.push(values.shift()));
      } else {
        setImmediate(() => this.push(null));
      }
    },
  });

  return stream;
};

const generatorToStream = valueToBeStream => {
  return new Readable({
    objectMode: true,
    read() {
      const { value, done } = valueToBeStream.next();
      if (done) {
        setImmediate(() => this.push(null));
      } else {
        setImmediate(() => this.push(value));
      }
    },
  });
};

function* fibonacci(from, to, useString = false) {
  const parse = useString ? String : v => v;
  const infinite = !to && to !== 0;
  let current = 0;
  let next = 1;

  while (infinite || to--) {
    if (current >= Number.MAX_SAFE_INTEGER) {
      current = 0;
      next = 1;
    }
    if (current >= from) {
      yield parse(current);
    }
    [current, next] = [next, current + next];
  }
}

module.exports = { toStream, fibonacci, devNullStream };
