const { Readable, Stream } = require('stream');

const rxEscapable = /[\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;

// table of character substitutions
const meta = {
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r',
  '"': '\\"',
  '\\': '\\\\',
};

function getReadableStreamType(stream) {
  if (stream.outputType) {
    return 'Primitive';
  }
  return stream._readableState.objectMode ? 'Object' : 'String';
}

function getType(value) {
  if (!value) return 'Primitive';
  if (typeof value.then === 'function') return 'Promise';
  if (value instanceof Stream) return `Readable${getReadableStreamType(value)}`;
  if (Array.isArray(value)) return 'Array';
  if (typeof value === 'object' || value instanceof Object) return 'Object';
  return 'Primitive';
}

const stackItemEnd = {
  Array: ']',
  Object: '}',
  ReadableString: '"',
  ReadableObject: ']',
};

const stackItemOpen = {
  Array: '[',
  Object: '{',
  ReadableString: '"',
  ReadableObject: '[',
};

function readAsPromised(stream, size) {
  const value = stream.read(size);

  if (value === null) {
    return new Promise((resolve, reject) => {
      const endListener = () => resolve(null);
      stream.once('end', endListener);
      stream.once('error', reject);
      stream.once('readable', () => {
        stream.removeListener('end', endListener);
        stream.removeListener('error', reject);
        resolve(stream.read());
      });
    });
  }
  return Promise.resolve(value);
}
function recursiveResolve(promise) {
  return promise.then(res => {
    const resType = getType(res);
    return resType === 'Promise' ? recursiveResolve(res) : res;
  });
}

class JsonStreamStringify extends Readable {
  constructor(value, replacer, spaces) {
    super({});
    let gap;
    const spaceType = typeof spaces;
    if (spaceType === 'string' || spaceType === 'number') {
      gap = Number.isFinite(spaces) ? ' '.repeat(spaces) : spaces;
    }
    Object.assign(this, {
      stack: [],
      replacerFunction: replacer instanceof Function && replacer,
      replacerArray: Array.isArray(replacer) && replacer,
      gap,
      depth: 0,
    });
    this.addToStack(value);
  }

  addToStack(value, key, index, parent) {
    let realValue = value;
    if (this.replacerFunction) {
      realValue = this.replacerFunction(key || index, realValue, this);
    }
    // ORDER?
    if (realValue && realValue.toJSON instanceof Function) {
      realValue = realValue.toJSON();
    }
    if (realValue instanceof Function || typeof value === 'symbol') {
      realValue = undefined;
    }
    if (key !== undefined && this.replacerArray) {
      if (!this.replacerArray.includes(key)) {
        realValue = undefined;
      }
    }
    let type = getType(realValue);
    if (
      (parent && parent.type === 'Array' ? true : realValue !== undefined) &&
      type !== 'Promise'
    ) {
      if (parent && !parent.first) {
        this._push(',');
      }
      /* eslint-disable-next-line no-param-reassign */
      if (parent) parent.first = false;
    }
    if (realValue !== undefined && type !== 'Promise' && key) {
      if (this.gap) {
        this._push(`\n${this.gap.repeat(this.depth)}"${escapeString(key)}": `);
      } else {
        this._push(`"${escapeString(key)}":`);
      }
    }
    if (type !== 'Primitive') {
      if (this.cycle) {
        // run cycler
        realValue = this.cycler(key || index, realValue);
        type = getType(realValue);
      } else {
        // check for circular structure
        if (this.visited.has(realValue)) {
          throw Object.assign(
            new Error('Converting circular structure to JSON'),
            {
              realValue,
              key: key || index,
            },
          );
        }
        this.visited.add(realValue);
      }
    }

    if (!key && index > -1 && this.depth && this.gap)
      this._push(`\n${this.gap.repeat(this.depth)}`);

    const open = stackItemOpen[type];
    if (open) this._push(open);

    const obj = {
      key,
      index,
      type,
      value: realValue,
      parent,
      first: true,
    };

    if (type === 'Object') {
      this.depth += 1;
      obj.unread = Object.keys(realValue);
      obj.isEmpty = !obj.unread.length;
    } else if (type === 'Array') {
      this.depth += 1;
      obj.unread = Array.from(Array(realValue.length).keys());
      obj.isEmpty = !obj.unread.length;
    } else if (type.startsWith('Readable')) {
      this.depth += 1;
      if (
        realValue._readableState.ended &&
        realValue._readableState.endEmitted
      ) {
        const error = new Error(
          'Readable Stream has ended before it was serialized. All stream data have been lost',
        );
        this.emit('error', error, realValue, key || index);
        console.log(error);
      } else if (realValue._readableState.flowing) {
        realValue.pause();
        const error = new Error(
          'Readable Stream is in flowing mode, data may have been lost. Trying to pause stream.',
        );
        console.log(error);
        this.emit('error', error, realValue, key || index);
      }
      obj.readCount = 0;
      realValue.once('end', () => {
        obj.end = true;
        this.__read();
      });
      // realValue.once('finish', () => {
      //   obj.end = true;
      //   this.__read();
      // });
      realValue.once('error', err => {
        this.error = true;
        realValue.end();
        this.emit('error', err);
      });
    }
    this.stack.unshift(obj);
    return obj;
  }

  removeFromStack(item) {
    const { type } = item;
    const isObject =
      type === 'Object' || type === 'Array' || type.startsWith('Readable');
    if (type !== 'Primitive') {
      if (!this.cycle) {
        this.visited.delete(item.value);
      }
      if (isObject) {
        this.depth -= 1;
      }
    }

    const end = stackItemEnd[type];
    if (isObject && !item.isEmpty && this.gap)
      this._push(`\n${this.gap.repeat(this.depth)}`);
    if (end) this._push(end);
    const stackIndex = this.stack.indexOf(item);
    this.stack.splice(stackIndex, 1);
  }

  _push(data) {
    this.pushCalled = true;
    this.push(data);
  }

  processReadableObject(current, size) {
    if (current.end) {
      this.removeFromStack(current);
      return undefined;
    }
    return readAsPromised(current.value, size).then(value => {
      if (value !== null) {
        if (!current.first) {
          this._push(',');
        }
        /* eslint-disable no-param-reassign */
        current.first = false;
        this.addToStack(value, undefined, current.readCount);
        current.readCount += 1;
        /* eslint-enable no-param-reassign */
      }
    });
  }

  processObject(current) {
    // when no keys left, remove obj from stack
    if (!current.unread.length) {
      this.removeFromStack(current);
      return;
    }
    const key = current.unread.shift();
    const value = current.value[key];

    this.addToStack(
      value,
      current.type === 'Object' && key,
      current.type === 'Array' && key,
      current,
    );
  }

  processArray(current) {
    return this.processObject(current);
  }

  processPrimitive(current) {
    if (current.value !== undefined) {
      const type = typeof current.value;
      let value;
      switch (type) {
        case 'string':
          value = quoteString(current.value);
          break;
        case 'number':
          value = Number.isFinite(current.value)
            ? String(current.value)
            : 'null';
          break;
        case 'boolean':
        case 'null':
          value = String(current.value);
          break;
        case 'object':
          if (!current.value) {
            value = 'null';
            break;
          }
        /* eslint-disable-next-line no-fallthrough */
        default:
          // This should never happen, I can't imagine a situation where this executes.
          // If you find a way, please open a ticket or PR
          throw Object.assign(
            new Error(`Unknown type "${type}". Please file an issue!`),
            {
              value: current.value,
            },
          );
      }
      this._push(value);
    } else if (
      this.stack[1] &&
      (this.stack[1].type === 'Array' ||
        this.stack[1].type === 'ReadableObject')
    ) {
      this._push('null');
    } else {
      /* eslint-disable-next-line no-param-reassign */
      current.addSeparatorAfterEnd = false;
    }
    this.removeFromStack(current);
  }

  processReadablePrimitive(...args) {
    return this.processReadableString(...args);
  }

  processReadableString(current, size) {
    this.on('close', () => {
      current.value.end();
    });
    if (current.end) {
      this.removeFromStack(current);
      return undefined;
    }
    return readAsPromised(current.value, size).then(value => {
      const pushCalled = Boolean(value);
      while (value !== null) {
        this.push(value);
        value = current.value.read();
      }
      if (pushCalled) {
        this.pushCalled = true;
        if (current.value._readableState.ended) {
          current.end = true;
        }
      }
    });
  }

  processPromise(current) {
    return recursiveResolve(current.value).then(value => {
      this.removeFromStack(current);
      this.addToStack(value, current.key, current.index, current.parent);
    });
  }

  processStackTopItem(size) {
    const current = this.stack[0];
    if (!current || this.error) return Promise.resolve();
    let out;
    try {
      out = this[`process${current.type}`](current, size);
    } catch (err) {
      return Promise.reject(err);
    }
    return Promise.resolve(out).then(() => {
      if (this.stack.length === 0) {
        this.end = true;
        this._push(null);
      }
    });
  }

  __read(size) {
    if (this.isRunning || this.error) {
      this.readMore = true;
      return undefined;
    }
    this.isRunning = true;

    // we must continue to read while push has not been called
    this.readMore = false;
    return this.processStackTopItem(size)
      .then(() => {
        const readAgain =
          !this.end && !this.error && (this.readMore || !this.pushCalled);
        if (readAgain) {
          setImmediate(() => {
            this.isRunning = false;
            this.__read();
          });
        } else {
          this.isRunning = false;
        }
      })
      .catch(err => {
        this.error = true;
        this.emit('error', err);
      });
  }

  _read(size) {
    this.pushCalled = false;
    this.__read(size);
  }

  path() {
    return this.stack
      .map(({ key, index }) => key || index)
      .filter(v => v || v > -1)
      .reverse();
  }
}

module.exports = JsonStreamStringify;
