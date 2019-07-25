const { StackElement, jsonTypes } = require('./stackElements');
const { Readable } = require('stream');
const Deque = require('double-ended-queue');

class JSONStream extends Readable {
  constructor(value) {
    super();
    this.hasEnded = false;
    this.stack = new Deque(128);
    this.addFirstStackElement(value);
  }

  addFirstStackElement(value) {
    const shouldReturnUndefined = ['function', 'undefined', 'symbol'].includes(
      typeof value,
    );
    if (shouldReturnUndefined) {
      this.stack.push(new StackElement(undefined));
    } else {
      const stackElement = StackElement.factory(value);
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
