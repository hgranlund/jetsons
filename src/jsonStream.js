const debug = require('debug')('jetsons:JsonStream');
const { Readable } = require('stream');
const Denque = require('denque');
const { inspect } = require('util');
const { StackElement, StreamStackElement } = require('./stackElements');
const JsonStreamOptions = require('./jsonStreamOptions');
const { jsonTypes } = require('./constants');

const states = {
  waiting: Symbol('waiting'),
  readWhileReading: Symbol('readWhileReading'),
  reading: Symbol('reading'),
  ended: Symbol('ended'),
  error: Symbol('error'),
};

class JsonStream extends Readable {
  constructor(value, replacer, space) {
    super();
    this._stack = new Denque();
    this._state = states.waiting;
    debug(`Created`);

    const options = new JsonStreamOptions(replacer, space);
    this.addFirstStackElement(options.initReplace(value), options);

    this.on('close', () => this.onClose());
  }

  addFirstStackElement(value, options) {
    const shouldReturnUndefined = ['function', 'undefined', 'symbol'].includes(
      typeof value,
    );
    if (!shouldReturnUndefined) {
      this._stack.push(StackElement.factory(value, options));
    }
  }

  _read(size = 32384) {
    if (this._stack.isEmpty()) {
      if (this._state !== states.ended) {
        this._state = states.ended;
        this.push(null);
        debug('Completed');
      }
    } else if (this._state !== states.waiting) {
      if (this._state === states.reading) {
        this._state = states.readWhileReading;
      }
      return null;
    } else {
      this._state = states.reading;
      this.processStack(size)
        .then(() => {
          if (this._state === states.readWhileReading) {
            setImmediate(() => this._read());
          }
          this._state = states.waiting;
        })
        .catch(error => {
          this.handleError(error);
        });
    }
  }

  processStack(size) {
    try {
      if (this._stack.isEmpty() || size <= 0) {
        return Promise.resolve();
      }
      const element = this._stack.peekFront();
      const next = element.next();
      if (next instanceof Promise) {
        return next.then(n => this.handleNext(n, size));
      } else {
        return this.handleNext(next, size);
      }
    } catch (error) {
      return Promise.reject(error);
    }
  }

  handleNext({ next, elements, done }, size) {
    if (done) {
      this._stack.shift();
    }
    if (elements.length) {
      elements.reverse().forEach(element => this._stack.unshift(element));
    }
    if (next !== null) {
      const buffer = Buffer.from(next);
      if (this.push(buffer)) {
        return this.processStack(size - buffer.length);
      } else {
        return Promise.resolve();
      }
    } else {
      return this.processStack(size);
    }
  }

  handleError(error) {
    const newError = error;
    newError.jsonStreamStack = this._stack.toArray();
    debug(
      error,
      '\nWhile processing stack:',
      inspect(newError.jsonStreamStack, { maxArrayLength: 15 }),
    );
    this._state = states.error;
    setImmediate(() => this.emit('error', error));
  }

  onClose() {
    debug('JsonStream closed');
    this._stack
      .toArray()
      .filter(item => item instanceof StreamStackElement)
      .forEach(item => item.end());
  }
}

JsonStream.jsonTypes = jsonTypes;

module.exports = JsonStream;
