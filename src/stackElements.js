const debug = require('debug')('streamier:StackElements');
const { Stream } = require('stream');
const { quote, escapeString } = require('./utils');

const jsonTypes = {
  string: 'string',
  object: 'object',
  array: 'array',
  raw: 'raw',
};
const getStackElementClass = value => {
  const type = typeof value;
  if (value instanceof Promise) return PromiseStackElement;
  if (value instanceof Function) return EmptyStackElement;
  if (type === 'symbol') return EmptyStackElement;
  if (type === 'number') return NumberStackElement;
  if (type === 'string') return StringStackElement;
  if (type === 'boolean') return PrimitiveStackElement;
  if (type === 'undefined') return PrimitiveStackElement;
  if (value === null) return PrimitiveStackElement;
  if (value instanceof Stream) {
    if (value.jsonType) {
      switch (value.jsonType) {
        case jsonTypes.array:
          return ArrayStreamStackElement;
        case jsonTypes.raw:
          return StreamStackElement;
        case jsonTypes.string:
          return StringStreamStackElement;
        case jsonTypes.object:
          return ObjectStreamStackElement;
        default:
          break;
      }
      return StreamStackElement;
    } else if (value._readableState.objectMode) {
      return ObjectStreamStackElement;
    } else {
      return StringStreamStackElement;
    }
  }
  if (Array.isArray(value)) return ArrayStackElement;
  if (typeof value.then === 'function') return PromiseStackElement;
  if (typeof value === 'object' || value instanceof Object) {
    return ObjectStackElement;
  }
  return StackElement;
};

class StackElement {
  static factory(value) {
    if (value && value.toJSON instanceof Function) {
      value = value.toJSON();
    }
    const StackElementClass = getStackElementClass(value);
    return new StackElementClass(value);
  }

  constructor(value) {
    this.value = this.parseValue(value);
    this._isComplete = false;
    this.debug(`Created`);
  }

  get isComplete() {
    return this._isComplete;
  }

  completed() {
    this.debug(`Completed`);
    this._isComplete = true;
  }

  parseValue(value) {
    return value;
  }

  state(next, elements = []) {
    return { next, elements };
  }

  async next() {
    this.completed();
    return this.state(this.value);
  }

  debug(msg) {
    debug(`${this.constructor.name}: ${msg}`);
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
    this.completed();
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
    this._error = null;
    this._isEmpty = false;
    this._endState = super.state();
    this._firstState = null;
    this._first = true;
    this.initvValidate();
    value
      .on('end', () => {
        this.hasEnded = true;
      })
      .on('error', error => {
        this._error = error;
      });
  }

  initvValidate() {
    if (
      this.value._readableState.ended &&
      this.value._readableState.endEmitted
    ) {
      this._error = new Error(
        'Readable Stream has already ended. Unable to process it!',
      );
    } else if (this.value._readableState.flowing) {
      this._error = new Error(
        'ReadabelStream is in flowing mode, data may be lost',
      );
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
    this.validateOnNext();
    if (this._first) {
      this._first = false;
      if (this._firstState) {
        return this._firstState;
      }
    }
    const chunck = await this.readWhenReady();
    if (chunck !== null) {
      return this.state(chunck);
    } else if (this.hasEnded) {
      this._isEmpty = true;
      this.completed();
      return this._endState;
    } else {
      return this.next();
    }
  }

  validateOnNext() {
    if (this.value._readableState.flowing) {
      throw new Error('ReadabelStream is in flowing mode, data may be lost');
    }
    if (this._error) {
      this.completed();
      this.hasEnded = true;
      throw this._error;
    }
  }
}

class ArrayStreamStackElement extends StreamStackElement {
  constructor(value) {
    super(value);
    this._first = true;
    this._firstState = super.state(null, [new StackElement('[')]);
    this._endState = super.state(']');
    this._secondStateSendt = false;
  }

  state(next, elements = []) {
    if (!next) {
      return super.state(null, elements);
    }
    if (!this._secondStateSendt) {
      this._secondStateSendt = true;
      return super.state(escapeString(next.toString()), elements);
    } else {
      return super.state(', ' + escapeString(next.toString()), elements);
    }
  }
}

class StringStreamStackElement extends StreamStackElement {
  constructor(value) {
    super(value);
    this._first = true;
    this._firstState = super.state(null, [new StackElement('"')]);
    this._endState = super.state('"');
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
    this.completed();
    const result = await this.value;
    return this.state(null, [StackElement.factory(result)]);
  }
}

class ArrayStackElement extends StackElement {
  constructor(value) {
    super(value);
    this._first = true;
  }

  async next() {
    if (this._first) {
      this._first = false;
      return this.state('[');
    }

    const nextElements = [];
    this.value.forEach(item => {
      nextElements.push(StackElement.factory(item));
      nextElements.push(new StackElement(','));
    });
    nextElements.pop();
    nextElements.push(new StackElement(']'));
    this.completed();
    return this.state(null, nextElements);
  }
}

class ObjectStackElement extends StackElement {
  constructor(value) {
    super(value);
    this._first = true;
    this._entriesLeft = Object.entries(value).filter(([, value]) =>
      this.shouldValueBeStringified(value),
    );
  }

  get isEmpty() {
    return !this._entriesLeft.length;
  }

  shouldValueBeStringified(value) {
    const type = typeof value;
    return value !== undefined && type !== 'function' && type !== 'symbol';
  }

  async next() {
    if (this._first) {
      this._first = false;
      return this.state('{');
    }
    if (this.isEmpty) {
      this.completed();
      return this.state('}');
    }

    const [key, value] = this._entriesLeft.shift();
    const next = `"${key}": `;
    const nextElements = [StackElement.factory(value)];

    if (!this.isEmpty) {
      nextElements.push(new StackElement(','));
    }
    return this.state(next, nextElements);
  }
}

module.exports = { StackElement, EmptyStackElement, jsonTypes };
