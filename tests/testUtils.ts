import { Readable, ReadableOptions, Stream, Writable } from 'stream';
import { JsonStream, JsonStreamType, setJsonStreamType } from '../src';

class TestableJsonStream extends JsonStream {
  get;
}

export const devNullStream = (): Writable =>
  new Writable({
    write(chunk, encoding, done): void {
      setImmediate(done);
    },
  });

const toGenericStream = (valueToBeStream: any, options = {} as ReadableOptions) => {
  if (valueToBeStream.next instanceof Function) {
    return generatorToStream(valueToBeStream, { objectMode: true, ...options });
  } else if (valueToBeStream instanceof Promise) {
    return promiseToStream(valueToBeStream, options);
  } else if (typeof valueToBeStream === 'string') {
    return intoStream(valueToBeStream.split(''), { objectMode: false });
  } else {
    return intoStream(valueToBeStream, { objectMode: true, ...options });
  }
};

export const toStream = (
  value: any,
  jsonType?: JsonStreamType,
  options = {} as ReadableOptions,
): Stream => {
  const stream = toGenericStream(value, options);
  if (jsonType) {
    return setJsonStreamType(stream, jsonType);
  }
  return stream;
};

const intoStream = (obj: any, options: ReadableOptions): Readable => {
  const values = Array.isArray(obj) ? Array.from(obj) : [obj];
  const stream = new Readable({
    ...options,
    read(): void {
      if (values.length) {
        setImmediate(() => this.push(values.shift()));
      } else {
        setImmediate(() => this.push(null));
      }
    },
  });

  return stream;
};

const generatorToStream = (
  valueToBeStream: Generator<any, void, unknown>,
  options: ReadableOptions,
): Readable => {
  return new Readable({
    ...options,
    read(): void {
      const { value, done } = valueToBeStream.next();
      if (done) {
        setImmediate(() => this.push(null));
      } else {
        setImmediate(() => this.push(value));
      }
    },
  });
};

const promiseToStream = (valueToBeStream: Promise<any>, options: ReadableOptions): Readable => {
  let called = false;
  return new Readable({
    ...options,
    read(): any {
      if (!called) {
        called = true;
        valueToBeStream
          .then((value) => {
            this.push(value);
            setImmediate(() => this.push(null));
          })
          .catch((error) => this.emit('error', error));
      }
      return null;
    },
  });
};

export function* fibonacci(
  from: number,
  to: number,
  useString = false,
): Generator<any, void, unknown> {
  const parse = useString ? String : (v) => v;
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
