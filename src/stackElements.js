const { Stream } = require('stream');
const { quote, escapeString } = require('./utils');

class StackElement {
  static factory(value) {
    const type = typeof value;
    if (!value) return new PrimitiveStackElement(value);
    if (typeof value.then === 'function') return new PromiseStackElement(value);
    if (value instanceof Promise) return new PromiseStackElement(value);
    if (type === 'number') return new NumberStackElement(value);
    if (type === 'string') return new StringStackElement(value);
    if (type === 'boolean') return new PrimitiveStackElement(value);
    if (value instanceof Stream) {
      if (value._readableState.objectMode) {
        return new ObjectStreamStackElement(value);
      } else if (value.streamRaw) {
        return new StreamStackElement(value);
      } else {
        return new StringStreamStackElement(value);
      }
    }
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

  async next() {
    this._isComplete = true;
    return this.state(this.value);
  }
}

class StringStackElement extends StackElement {
  parseValue(value) {
    return quote(value);
    // return JSON.stringify(value);
    // return `"${value}"`;
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

class StreamStackElement extends StackElement {
  constructor(value) {
    super(value);
    this.error = null;
    this.endState = super.state();
    this.firstState = null;
    this.first = true;
    value
      .on('end', () => {
        this.hasEnded = true;
      })
      .on('error', error => {
        this.error = error;
      });
  }

  readWhenReady() {
    const chunck = this.value.read();
    if (chunck !== null) {
      return Promise.resolve(chunck);
    }
    return new Promise((resolve, reject) => {
      const endListener = () => resolve();
      this.value.once('end', endListener);
      this.value.once('error', reject);
      this.value.once('readable', () => {
        this.value.removeListener('end', endListener);
        this.value.removeListener('error', reject);
        resolve(this.value.read());
      });
    });
  }

  async next() {
    if (this.error) {
      this._isComplete = true;
      this.hasEnded = true;
      throw this.error;
    }
    if (this.first) {
      this.first = false;
      if (this.firstState) {
        return this.firstState;
      }
    }
    if (this.hasEnded) {
      this._isComplete = true;
      return this.endState;
    }
    const chunck = await this.readWhenReady();
    if (chunck || this.hasEnded) {
      return this.state(chunck);
    } else {
      return this.next();
    }
  }
}

class StringStreamStackElement extends StreamStackElement {
  constructor(value) {
    super(value);
    this.first = true;
    this.firstState = super.state(null, [new StackElement('"')]);
    this.endState = super.state('"');
  }

  state(next, elements = []) {
    if (!next) {
      return super.state(null, elements);
    }
    return super.state(escapeString(next.toString()), elements);
  }
}

class ObjectStreamStackElement extends StreamStackElement {
  state(next) {
    if (next === null) {
      return super.state();
    }
    return super.state(null, [StackElement.factory(next)]);
  }
}

class PromiseStackElement extends StackElement {
  async next() {
    this._isComplete = true;
    const result = await this.value;
    return this.state(null, [StackElement.factory(result)]);
  }
}

class ArrayStackElement extends StackElement {
  constructor(value) {
    super(value);
    this.first = true;
    this.type = 'array';
  }

  async next() {
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
    this.entries = Object.entries(value);
  }

  get hasEntriesLeft() {
    return this.entries.length;
  }

  async next() {
    if (this.first) {
      this.first = false;
      return this.state('{');
    }
    if (!this.hasEntriesLeft) {
      this._isComplete = true;
      return this.state('}');
    }

    const [key, value] = this.entries.shift();
    const next = `"${key}": `;
    const nextElements = [StackElement.factory(value)];

    if (this.hasEntriesLeft) {
      nextElements.push(new StackElement(','));
    }
    return this.state(next, nextElements);
  }
}
module.exports = StackElement;
