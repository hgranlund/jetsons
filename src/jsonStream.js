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
    this.stack = new Deque(64);
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
      this.stack.push(new StackElement(undefined, options));
    } else {
      const stackElement = StackElement.factory(value, options);
      this.stack.push(stackElement);
    }
  }

  shouldStartToRead() {
    if (this.reading || this.hasEnded) {
      return false;
    } else if (this.stack.isEmpty()) {
      this.push(null);
      this._state = states.ended;
      debug('Completed');
      return false;
    } else {
      return true;
    }
  }

  _read() {
    if (this.stack.isEmpty()) {
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
        this._state = states.error;
      });
  }

  async processStack() {
    const toContinue = await this.processTopStackElement();
    if (toContinue) {
      return this.processStack();
    }
    return toContinue;
  }

  async processTopStackElement() {
    if (this.stack.isEmpty()) {
      return false;
    }

    const element = this.stack.peekFront();
    const { next, elements, done } = await element.next();
    if (done) {
      this.stack.shift();
    }
    if (elements.length) {
      this.stack.unshift(...elements);
    }
    if (next !== null) {
      return this.push(next);
    }
    return true;
  }

  handleError(error) {
    const newError = error;
    newError.jsonStreamStack = this.stack.toArray();
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
    this.stack
      .toArray()
      .filter(item => item instanceof StreamStackElement)
      .forEach(item => item.end());
  }
}

JsonStream.jsonTypes = jsonTypes;

module.exports = JsonStream;
