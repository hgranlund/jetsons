const { Readable, Writable } = require('stream');

const devNullStream = () =>
  Writable({
    write(chunk, encoding, done) {
      setImmediate(done);
    },
  });

const toGenericStream = (valueToBeStream, options = {}) => {
  if (valueToBeStream.next instanceof Function) {
    return generatorToStream(valueToBeStream, { objectMode: true, ...options });
  } else if (valueToBeStream instanceof Promise) {
    return promiseToStream(valueToBeStream, options);
  } else if (typeof valueToBeStream === 'string') {
    return intoStream(valueToBeStream.split(''), { objectMode: false });
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
  const values = Array.isArray(obj) ? Array.from(obj) : [obj];
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

const generatorToStream = (valueToBeStream, options) => {
  return new Readable({
    ...options,
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

const promiseToStream = (valueToBeStream, options) => {
  let called = false;
  return new Readable({
    ...options,
    read() {
      if (!called) {
        called = true;
        valueToBeStream
          .then(value => {
            this.push(value);
            setImmediate(() => this.push(null));
          })
          .catch(error => this.emit('error', error));
      }
      return null;
    },
  });
};

function* fibonacci(from, to, useString = false) {
  const parse = useString ? String : v => v;
  const infinite = !to && to !== 0;
  let current = 0;
  let next = 1;

  while (infinite || to--) {
    if (current >= from) {
      yield parse(current);
    }
    [current, next] = [next, current + next];
  }
}

module.exports = { toStream, fibonacci, devNullStream };
