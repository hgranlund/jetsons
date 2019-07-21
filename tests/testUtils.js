const intoStream = require('into-stream');
const { Readable } = require('stream');
const { inspect } = require('util');

const toJson = stream => {
  return new Promise((resolve, reject) => {
    const strings = [];
    stream
      .on('readable', () => {
        let data;
        while ((data = stream.read())) {
          strings.push(data.toString());
        }
      })
      .on('end', () => {
        try {
          resolve(JSON.parse(strings.join('')));
        } catch (error) {
          reject(
            new Error(`${error.message}
            ${inspect(strings.join(''))}`),
          );
        }
      })
      .on('error', error => {
        reject(error);
      });
  });
};

const toStream = (value, streamAsRaw = false) => {
  if (streamAsRaw) {
    const stream = intoStream('"aValue"');
    stream.streamRaw = true;
    return stream;
  } else if (typeof value === 'string') {
    return intoStream(value);
  } else {
    return intoObjectStream(value);
  }
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

function* fibonacci(n) {
  const infinite = !n && n !== 0;
  let current = 0;
  let next = 1;

  while (infinite || n--) {
    if (current >= Number.MAX_SAFE_INTEGER) {
      current = 0;
      next = 1;
    }
    yield current;
    [current, next] = [next, current + next];
  }
}

module.exports = { toJson, toStream, fibonacci };
