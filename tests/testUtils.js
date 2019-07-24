const intoStream = require('into-stream');
const { Readable, Writable } = require('stream');
const devNullStream = () =>
  Writable({
    write(chunk, encoding, done) {
      setImmediate(done);
    },
  });

const toGenericStream = value => {
  if (value.next instanceof Function) {
    return Readable.from(value, { objectMode: true });
  } else if (typeof value === 'string') {
    return intoStream(value);
  } else {
    return intoObjectStream(value);
  }
};

const toStream = (value, jsonType) => {
  const stream = toGenericStream(value);
  stream.jsonType = jsonType;
  return stream;
};

const intoObjectStream = obj => {
  const values = Array.isArray(obj) ? obj : [obj];
  const stream = new Readable({
    objectMode: true,
    read() {
      if (values.length) {
        this.push(values.pop());
      } else {
        this.push(null);
      }
    },
  });

  return stream;
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
