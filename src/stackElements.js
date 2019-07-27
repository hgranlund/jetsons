const debug = require('debug')('jetson:StackElements');
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
  if (type === 'bigint') {
    throw new Error(`BigInt value can't be serialized in JSON`);
  }
  return StackElement;
};

class StackElement {
  constructor(value, replacer, space, depth) {
    this.value = this.parseValue(value);
    this.replacer = replacer;
    this._space = space;
    this._isComplete = false;
    this.depth = depth;
    this.debug(`Created`);
  }

  static factory(value, replacer, space, depth = 0) {
    if (value && value.toJSON instanceof Function) {
      value = value.toJSON();
    }
    const StackElementClass = getStackElementClass(value);
    return new StackElementClass(value, replacer, space, depth);
  }

  get isComplete() {
    return this._isComplete;
  }

  spaceStart(char = '') {
    return char + this._space(this.depth);
  }

  spaceEnd(char = '') {
    return this._space(this.depth) + char;
  }

  newSpacedElement(char, start = true) {
    return new StackElement(
      start ? this.spaceStart(char) : this.spaceEnd(char),
      this.replacer,
      this._space,
      this.depth,
    );
  }

  newElement(value, depth = this.depth) {
    return StackElement.factory(value, this.replacer, this._space, depth);
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
  constructor(value, replacer, space, depth) {
    super(value, replacer, space, depth);
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
  constructor(value, replacer, space, depth) {
    super(value, replacer, space, depth);
    this._error = null;
    this._isEmpty = false;
    this._endState = super.state();
    this._firstState = null;
    this._first = true;
    this.hasEnded = false;
    this.initValidate();
    value
      .on('end', () => {
        this.hasEnded = true;
      })
      .on('error', error => {
        this._error = error;
      });
  }

  initValidate() {
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
  constructor(value, replacer, space, depth) {
    super(value, replacer, space, depth);
    this._first = true;
    this._firstState = super.state(null, [this.newSpacedElement('[')]);
    this._endState = super.state(this.spaceEnd(']'));
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
      return super.state(
        `,${this.spaceStart()}${escapeString(next.toString())}`,
        elements,
      );
    }
  }
}

class StringStreamStackElement extends StreamStackElement {
  constructor(value, replacer, space, depth) {
    super(value, replacer, space, depth);
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
  constructor(...args) {
    super(...args);
    this.depth++;
  }
  state(next) {
    if (next === null) {
      return super.state();
    }
    return super.state(null, [this.newElement(next)]);
  }
}

class PromiseStackElement extends StackElement {
  async next() {
    this.completed();
    const result = await this.value;
    return this.state(null, [this.newElement(result)]);
  }
}

class ArrayStackElement extends StackElement {
  constructor(value, replacer, space, depth) {
    super(value, replacer, space, depth);
    this._first = true;
    this.depth++;
  }

  async next() {
    if (this._first) {
      this._first = false;
      return this.state(this.spaceStart('['));
    }

    const nextElements = [];
    this.value.forEach(item => {
      nextElements.push(this.newElement(item));
      nextElements.push(this.newSpacedElement(','));
    });
    nextElements.pop();
    this.depth--;
    // nextElements.push(this.newSpacedElement());
    nextElements.push(this.newSpacedElement(']', false));
    this.completed();
    return this.state(null, nextElements);
  }
}

class ObjectStackElement extends StackElement {
  constructor(value, replacer, space, depth) {
    super(value, replacer, space, depth);
    this._first = true;
    this.depth++;
    this._entriesLeft = this.entriesToProcess();
  }

  get isEmpty() {
    return !this._entriesLeft.length;
  }

  entriesToProcess() {
    let entries = Object.entries(this.value);
    if (typeof this.replacer === 'function') {
      entries = entries.map(([key, value]) => [key, this.replacer(key, value)]);
    }
    if (Array.isArray(this.replacer)) {
      entries = entries.filter(([key]) => this.replacer.includes(key));
    }
    return entries.filter(([, value]) => this.shouldValueBeStringified(value));
  }

  shouldValueBeStringified(value) {
    const type = typeof value;
    return value !== undefined && type !== 'function' && type !== 'symbol';
  }

  async next() {
    if (this._first) {
      this._first = false;
      return this.state(this.spaceStart('{'));
    }
    if (this.isEmpty) {
      this.completed();
      this.depth--;
      return this.state(this.spaceEnd('}'));
    }

    const [key, value] = this._entriesLeft.shift();
    const next = `"${key}":${this.spaceEnd() ? ' ' : ''}`;
    const nextElements = [this.newElement(value)];

    if (!this.isEmpty) {
      nextElements.push(this.newSpacedElement(','));
    }
    return this.state(next, nextElements);
  }
}

module.exports = { StackElement, EmptyStackElement, jsonTypes };
