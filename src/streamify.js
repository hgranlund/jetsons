const StackElement = require('./stackElements');
const { Readable } = require('stream');

class Streamify extends Readable {
  constructor(value) {
    super();
    this.hasEnded = false;
    this.stack = [];
    this.addToStack(value);
  }

  get peekStack() {
    return this.stack[0];
  }

  get isEmpty() {
    return !this.stack.length;
  }

  _read() {
    if (this.reading) {
      return null;
    }
    if (this.isEmpty) {
      this.push(null);
      this.hasEnded = true;
      return;
    }
    if (this.hasEnded) {
      return;
    }
    this.reading = true;
    this.processStack()
      .then(() => (this.reading = false))
      .catch(error => {
        this.error = error;
        this.hasEnded = true;
        this.reading = false;
        setImmediate(() => this.emit('error', error));
      });
  }

  addToStack(value) {
    this.stack.push(StackElement.factory(value));
  }

  async processStack() {
    const toContinue = await this.processTopStackElement();
    if (toContinue) {
      return this.processStack();
    }
    return toContinue;
  }

  async processTopStackElement() {
    if (this.isEmpty) return false;
    const element = this.peekStack;
    const { next, elements = [] } = await element.next();
    if (element.isComplete) {
      this.stack.shift();
    }
    if (elements.length) {
      this.stack = elements.concat(this.stack);
    }
    if (next) {
      return this.push(next);
    }
    return true;
  }
}

module.exports = Streamify;
