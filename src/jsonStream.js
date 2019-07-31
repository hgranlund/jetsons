const debug = require('debug')('jetsons:JsonStream');
const {
  StackElement,
  StreamStackElement,
  jsonTypes,
} = require('./stackElements');
const { Readable } = require('stream');
const Deque = require('double-ended-queue');
const { inspect } = require('util');
const JsonStreamOptions = require('./jsonStreamOptions');

class JsonStream extends Readable {
  constructor(value, replacer, space) {
    super();
    this.hasEnded = false;
    this.stack = new Deque(128);

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

  get peekStack() {
    return this.stack.peekFront();
  }

  get isEmpty() {
    return this.stack.isEmpty();
  }

  shouldStartToRead() {
    if (this.reading) {
      return false;
    }
    if (this.isEmpty) {
      this.push(null);
      this.hasEnded = true;
      debug('Completed');
      return false;
    }
    if (this.hasEnded) {
      return false;
    }
    return true;
  }

  _read() {
    if (!this.shouldStartToRead()) {
      return null;
    }
    this.reading = true;
    this.processStack().then(() => (this.reading = false));
  }

  async processStack() {
    try {
      const toContinue = await this.processTopStackElement();
      if (toContinue) {
        return this.processStack();
      }
      return toContinue;
    } catch (error) {
      this.handleError(error);
      return false;
    }
  }

  async processTopStackElement() {
    if (this.isEmpty) return false;
    const element = this.peekStack;
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
    this.error = error;
    this.error.jsonStreamStack = this.stack.toArray();
    debug(
      error,
      '\nWhile processing stack:',
      inspect(this.error.jsonStreamStack, { maxArrayLength: 15 }),
    );
    this.hasEnded = true;
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
