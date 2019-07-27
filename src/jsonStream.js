const debug = require('debug')('streamier:JsonStream');
const { StackElement, jsonTypes } = require('./stackElements');
const { Readable } = require('stream');
const Deque = require('double-ended-queue');
const { inspect } = require('util');
class JSONStream extends Readable {
  constructor(value, replacer, space) {
    super();
    this.replacer = replacer;
    this.space = this.spaceFunction(space);
    this.hasEnded = false;
    this.stack = new Deque(128);
    this.addFirstStackElement(value);
    debug(`Created`);
  }

  spaceFunction(space) {
    if (Number.isInteger(space)) {
      return depth => `\n${' '.repeat(depth * space)}`;
    }
    if (typeof space === 'string') {
      const newSpace = space.substring(0, 10);
      return depth => `\n${newSpace.repeat(depth)}`;
    }
    return () => '';
  }

  addFirstStackElement(value) {
    const shouldReturnUndefined = ['function', 'undefined', 'symbol'].includes(
      typeof value,
    );
    if (shouldReturnUndefined) {
      this.stack.push(new StackElement(undefined, this.replacer, this.space));
    } else {
      const stackElement = StackElement.factory(
        value,
        this.replacer,
        this.space,
      );
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

  async processTopStackElement() {
    if (this.isEmpty) return false;
    const element = this.peekStack;
    const { next, elements = [] } = await element.next();
    if (element.isComplete) {
      this.stack.shift();
    }
    if (elements.length) {
      elements.reverse().forEach(elm => this.stack.unshift(elm));
    }
    if (next !== null) {
      return this.push(next);
    }
    return true;
  }
}

JSONStream.jsonTypes = jsonTypes;

module.exports = JSONStream;
