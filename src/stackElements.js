const { Stream } = require('stream');
const { quote, escapeString } = require('./utils');

const jsonTypes = {
  string: 'string',
  object: 'object',
  array: 'array',
  raw: 'raw',
};

class StackElement {
  static factory(value) {
    if (value && value.toJSON instanceof Function) {
      value = value.toJSON();
    }
    const type = typeof value;
    if (!value) return new PrimitiveStackElement(value);
    if (typeof value.then === 'function') return new PromiseStackElement(value);
    if (value instanceof Promise) return new PromiseStackElement(value);
    if (value instanceof Function) return new EmptyStackElement();
    if (type === 'symbol') return new EmptyStackElement();
    if (type === 'number') return new NumberStackElement(value);
    if (type === 'string') return new StringStackElement(value);
    if (type === 'boolean') return new PrimitiveStackElement(value);
    if (value instanceof Stream) {
      if (value.jsonType) {
        switch (value.jsonType) {
          case jsonTypes.array:
            return new ArrayStreamStackElement(value);
          case jsonTypes.raw:
            return new StreamStackElement(value);
          case jsonTypes.string:
            return new StringStreamStackElement(value);
          case jsonTypes.object:
            return new ObjectStreamStackElement(value);
          default:
            break;
        }
        return new StreamStackElement(value);
      } else if (value._readableState.objectMode) {
        return new ObjectStreamStackElement(value);
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
  }
}

class EmptyStackElement extends StackElement {
  constructor() {
    super();
    this._isComplete = true;
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
    this.isEmpty = false;
    this.endState = super.state();
    this.firstState = null;
    this.first = true;
    this.validate();
    value
      .on('end', () => {
        this.hasEnded = true;
      })
      .on('error', error => {
        this.error = error;
      });
  }

  validate() {
    if (
      this.value._readableState.ended &&
      this.value._readableState.endEmitted
    ) {
      this.error = new Error(
        'Readable Stream has already ended. Unable to process it!',
      );
    } else if (this.value._readableState.flowing) {
      this.error = new Error('Readable Stream is already in flowing mode.');
    }
  }

  readWhenReady() {
    const chunck = this.value.read();
    if (chunck !== null) {
      return Promise.resolve(chunck);
    }
    if (this.hasEnded) {
      return Promise.resolve(null);
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
    const chunck = await this.readWhenReady();
    if (chunck !== null) {
      return this.state(chunck);
    } else if (this.hasEnded) {
      this.isEmpty = true;
      this._isComplete = true;
      return this.endState;
    } else {
      return this.next();
    }
  }
}

class ArrayStreamStackElement extends StreamStackElement {
  constructor(value) {
    super(value);
    this.first = true;
    this.firstState = super.state(null, [new StackElement('[')]);
    this.endState = super.state(']');
    this.secondStateSendt = false;
  }

  state(next, elements = []) {
    if (!next) {
      return super.state(null, elements);
    }
    if (!this.secondStateSendt) {
      this.secondStateSendt = true;
      return super.state(escapeString(next.toString()), elements);
    } else {
      return super.state(', ' + escapeString(next.toString()), elements);
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
    this.entries = Object.entries(value).filter(([, value]) =>
      this.shouldValueBeStringified(value),
    );
  }

  get isEmpty() {
    return !this.entries.length;
  }

  shouldValueBeStringified(value) {
    const type = typeof value;
    return value !== undefined && type !== 'function' && type !== 'symbol';
  }

  async next() {
    if (this.first) {
      this.first = false;
      return this.state('{');
    }
    if (this.isEmpty) {
      this._isComplete = true;
      return this.state('}');
    }

    const [key, value] = this.entries.shift();
    const next = `"${key}": `;
    const nextElements = [StackElement.factory(value)];

    if (!this.isEmpty) {
      nextElements.push(new StackElement(','));
    }
    return this.state(next, nextElements);
  }
}

module.exports = { StackElement, jsonTypes };
