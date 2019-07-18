const { Readable, Stream } = require('stream');

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
    this.reading = true;
    if (this.isEmpty) {
      this.push(null);
      this.hasEnded = true;
      return;
    }
    if (this.hasEnded) {
      return;
    }

    if (this.processStackElement()) {
      setImmediate(() => this.processStackElement());
    } else {
      this.reading = false;
    }
  }

  addToStack(value) {
    this.stack.push(StackElement.factory(value));
  }

  processStackElement() {
    if (this.isEmpty) return false;
    const element = this.peekStack;
    const { next, elements = [] } = element.next();
    if (element.isComplete) {
      this.stack.shift();
    }
    if (elements.length) {
      this.stack = elements.concat(this.stack);
    }
    if (next) {
      return this.push(next);
    }
    return false;
  }
}

class StackElement {
  static factory(value) {
    const type = typeof value;
    if (!value) return new PrimitiveStackElement(value);
    // if (typeof value.then === 'function') return 'Promise';
    if (type === 'number') return new NumberStackElement(value);
    if (type === 'string') return new StringStackElement(value);
    if (type === 'boolean') return new PrimitiveStackElement(value);
    // if (value instanceof Stream)
    //   return `Readable${getReadableStreamType(value)}`;
    if (Array.isArray(value)) return new ArrayStackElement(value);
    if (typeof value === 'object' || value instanceof Object) {
      return new ObjectStackElement(value);
    }
    return new StackElement(value);
  }

  constructor(value) {
    this.value = this.parseValue(value);
    this.type = 'Primitive';
    this._isComplete = false;
  }

  get isComplete() {
    return this._isComplete;
  }

  parseValue(value) {
    return value;
  }

  state(next, elements = []) {
    return { next, elements };
  }

  next() {
    this._isComplete = true;
    return this.state(this.value);
  }
}

class StringStackElement extends StackElement {
  parseValue(value) {
    return `"${value}"`;
  }
}

class PrimitiveStackElement extends StackElement {
  parseValue(value) {
    return String(value);
  }
}

class NumberStackElement extends StackElement {
  parseValue(value) {
    if (Number.isFinite(value)) {
      return String(value);
    } else {
      return 'null';
    }
  }
}

class ArrayStackElement extends StackElement {
  constructor(value) {
    super(value);
    this.first = true;
    this.type = 'array';
  }

  next() {
    if (this.first) {
      this.first = false;
      return this.state('[');
    }

    const nextElements = [];
    this.value.forEach(item => {
      nextElements.push(StackElement.factory(item));
      nextElements.push(new StackElement(','));
    });
    nextElements.pop();
    nextElements.push(new StackElement(']'));
    this._isComplete = true;
    return this.state(null, nextElements);
  }
}

class ObjectStackElement extends StackElement {
  constructor(value) {
    super(value);
    this.first = true;
    this.type = 'object';
    this.keys = Object.keys(value);
  }

  next() {
    if (this.first) {
      this.first = false;
      return this.state('{');
    }
    if (!this.keys.length) {
      this._isComplete = true;
      return this.state('}');
    }

    const key = this.keys.shift();
    const value = this.value[key];
    const next = `"${key}": `;
    const nextElements = [StackElement.factory(value)];

    if (this.keys.length) {
      nextElements.push(new StackElement(','));
    }
    return this.state(next, nextElements);
  }
}

module.exports = Streamify;
