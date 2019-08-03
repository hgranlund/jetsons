const debug = require('debug')('jetsons:JsonStream');
const { Readable } = require('stream');
const Deque = require('double-ended-queue');
const { inspect } = require('util');
const { StackElement, StreamStackElement } = require('./stackElements');
const JsonStreamOptions = require('./jsonStreamOptions');
const { jsonTypes } = require('./constants');

const states = {
  waiting: Symbol('waiting'),
  reading: Symbol('reading'),
  ended: Symbol('ended'),
  error: Symbol('error'),
};

class JsonStream extends Readable {
  constructor(value, replacer, space) {
    super();
    this._stack = new Deque(64);
    this._state = states.waiting;

    const options = new JsonStreamOptions(replacer, space);
    this.addFirstStackElement(options.initReplace(value), options);

    this.on('close', () => this.onClose());
    debug(`Created`);
  }

  addFirstStackElement(value, options) {
    const shouldReturnUndefined = ['function', 'undefined', 'symbol'].includes(
      typeof value,
    );
    if (shouldReturnUndefined) {
      this._stack.push(new StackElement(undefined, options));
    } else {
      this._stack.push(StackElement.factory(value, options));
    }
  }

  _read() {
    if (this._stack.isEmpty()) {
      this.push(null);
      this._state = states.ended;
      debug('Completed');
    }
    if (this._state !== states.waiting) {
      return null;
    }
    this._state = states.reading;
    this.processStack()
      .then(() => (this._state = states.waiting))
      .catch(error => {
        this.handleError(error);
      });
  }

  processStack() {
    if (this._stack.isEmpty()) {
      return Promise.resolve(false);
    }
    const element = this._stack.peekFront();
    return element.next().then(({ next, elements, done }) => {
      if (done) {
        this._stack.shift();
      }
      if (elements.length) {
        this._stack.unshift(...elements);
      }
      if (next !== null) {
        if (this.push(next)) {
          return this.processStack();
        } else {
          return false;
        }
      } else {
        return this.processStack();
      }
    });
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
