const { Stream } = require('stream');
const { quote } = require('./utils');

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

class StringStreamStackElement extends StackElement {
  async next() {
    this._isComplete = true;
    return this.state('"', [
      new StreamStackElement(this.value),
      new StackElement('"'),
    ]);
  }
}

class StreamStackElement extends StackElement {
  constructor(value) {
    super(value);
    this.error = null;
    value
      .on('end', () => {
        this._isComplete = true;
      })
      .on('error', error => {
        this.error = error;
      });
  }
  whenReady() {
    return new Promise((resolve, reject) => {
      const endListener = () => resolve();
      this.value.once('end', endListener);
      this.value.once('error', reject);
      this.value.once('readable', () => {
        this.value.removeListener('end', endListener);
        this.value.removeListener('error', reject);
        resolve();
      });
    });
  }

  async next() {
    if (this.error) {
      this._isComplete = true;
      throw this.error;
    }
    if (this._isComplete) {
      return this.state();
    }
    await this.whenReady();
    const chunck = this.value.read();
    if (chunck || this._isComplete) {
      return this.state(chunck);
    } else {
      return this.next();
    }
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
