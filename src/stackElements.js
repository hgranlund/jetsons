const debug = require('debug')('jetsons:StackElements');
const { Stream } = require('stream');
const { quote, escapeString, endStream } = require('./utils');

const jsonTypes = {
  string: 'string',
  array: 'array',
  raw: 'raw',
};

const getStreamStackElementClass = value => {
  if (value.jsonType) {
    switch (value.jsonType) {
      case jsonTypes.array:
        if (value._readableState.objectMode) {
          return ArrayObjectStreamStackElement;
        } else {
          return ArrayStreamStackElement;
        }
      case jsonTypes.raw:
        return StreamStackElement;
      case jsonTypes.string:
        return StringStreamStackElement;
      default:
        break;
    }
  }
  if (value._readableState.objectMode) {
    return ArrayObjectStreamStackElement;
  } else {
    return StringStreamStackElement;
  }
};

const getStackElementClass = value => {
  switch (typeof value) {
    case 'number':
      return NumberStackElement;
    case 'boolean':
      return PrimitiveStackElement;
    case 'string':
      return StringStackElement;
    case 'undefined':
      return NullStackElement;
    case 'object':
      if (value === null) return NullStackElement;
      if (Array.isArray(value)) return ArrayStackElement;
      if (value instanceof Stream) {
        return getStreamStackElementClass(value);
      }
      if (value instanceof Promise || typeof value.then === 'function') {
        return PromiseStackElement;
      }
      return ObjectStackElement;
    case 'symbol':
      return NullStackElement;
    case 'function':
      return NullStackElement;
    case 'bigint':
      throw new Error(`BigInt value can't be serialized in JSON`);
    default:
      throw new Error(
        `type ${typeof value} - ${value} value can't be serialized in JSON`,
      );
  }
};

class StackElement {
  constructor(value, options, depth) {
    this.options = options;
    this._isComplete = false;
    this.value = this.parseValue(value);
    this.depth = depth;
    this.debug('Created');
  }

  static factory(value, options, depth = 0) {
    if (value && value.toJSON instanceof Function) {
      value = value.toJSON();
    }
    const StackElementClass = getStackElementClass(value);
    return new StackElementClass(value, options, depth);
  }

  spaceStart(char) {
    return char + this.options.space(this.depth);
  }

  spaceEnd(char) {
    return this.options.space(this.depth) + char;
  }

  newSpacedElement(char, start = true) {
    return new StackElement(
      start ? this.spaceStart(char) : this.spaceEnd(char),
      this.options,
      this.depth,
    );
  }

  newElement(value, depth = this.depth) {
    return StackElement.factory(value, this.options, depth);
  }

  completed() {
    this.debug('Completed');
    this._isComplete = true;
  }

  parseValue(value) {
    return value;
  }

  state(next, elements = []) {
    return { next, elements, done: this._isComplete };
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

class PrimitiveStackElement extends StackElement {
  parseValue(value) {
    return String(value);
  }
}
class NullStackElement extends PrimitiveStackElement {
  constructor(_, options, depth) {
    super(null, options, depth);
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
  constructor(...args) {
    super(...args);
    this._error = null;
    this._isEmpty = false;
    this._first = true;
    this.hasEnded = false;
    this.initValidate();
    this.value
      .on('end', () => {
        this.hasEnded = true;
      })
      .on('error', error => {
        this._error = error;
      });
  }

  endState() {
    return super.state();
  }

  firstState() {
    return null;
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
        'Readable Stream is in flowing mode, data may be lost',
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
      if (this.firstState()) {
        return this.firstState();
      }
    }
    const chunck = await this.readWhenReady();
    if (chunck !== null) {
      return this.state(chunck);
    } else if (this.hasEnded) {
      this._isEmpty = true;
      this.completed();
      return this.endState();
    } else {
      return this.next();
    }
  }

  validateOnNext() {
    if (this.value._readableState.flowing) {
      throw new Error('Readable Stream is in flowing mode, data may be lost');
    }
    if (this._error) {
      this.completed();
      this.hasEnded = true;
      throw this._error;
    }
  }

  end() {
    if (!this.hasEnded) {
      this.debug('Closing stream');
      endStream(this.value);
    }
  }
}

class ArrayStreamStackElement extends StreamStackElement {
  constructor(...args) {
    super(...args);
    this._first = true;
    this._secondStateSendt = false;
    this.depth++;
  }

  endState() {
    this.depth--;
    return super.state(this.spaceEnd(']'));
  }

  firstState() {
    return super.state(null, [this.newSpacedElement('[')]);
  }

  state(next, elements = []) {
    if (next === null) {
      return super.state(null, elements);
    }
    if (!this._secondStateSendt) {
      this._secondStateSendt = true;
      return super.state(quote(next.toString()), elements);
    } else {
      return super.state(
        `${this.spaceStart(',')}${quote(next.toString())}`,
        elements,
      );
    }
  }
}

class StringStreamStackElement extends StreamStackElement {
  constructor(value, options, depth) {
    super(value, options, depth);
    this._first = true;
  }

  endState() {
    return super.state('"');
  }

  firstState() {
    return super.state(null, [new StackElement('"')]);
  }

  state(next, elements = []) {
    if (!next) {
      return super.state(null, elements);
    }
    return super.state(escapeString(next.toString()), elements);
  }
}

class ArrayObjectStreamStackElement extends ArrayStreamStackElement {
  state(next, elements = []) {
    if (next === null) {
      return super.state(null, elements);
    }
    if (this._secondStateSendt) {
      return super.state(null, [
        this.newSpacedElement(','),
        this.newElement(next),
      ]);
    } else {
      this._secondStateSendt = true;
      return super.state(null, [this.newElement(next)]);
    }
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
  constructor(value, options, depth) {
    super(value, options, depth);
    this._first = true;
    this.atIndex = 0;
    this.depth++;
  }

  async next() {
    if (this._first) {
      this._first = false;
      return this.state(this.spaceStart('['));
    }

    const nextElements = [];
    if (this.value.length - 1 > this.atIndex) {
      const to = Math.min(this.value.length - 1, this.atIndex + 1000);
      while (this.atIndex < to) {
        nextElements.push(this.newElement(this.value[this.atIndex]));
        nextElements.push(this.newSpacedElement(','));
        this.atIndex++;
      }
    }

    if (this.value.length - 1 === this.atIndex) {
      nextElements.push(this.newElement(this.value[this.atIndex]));
      this.atIndex++;
    }

    if (this.value.length === this.atIndex) {
      this.depth--;
      nextElements.push(this.newSpacedElement(']', false));
      this.completed();
    }
    return this.state(null, nextElements);
  }
}

class ObjectStackElement extends StackElement {
  constructor(value, options, depth) {
    super(value, options, depth);
    this._first = true;
    this.depth++;
  }

  get isEmpty() {
    return !this.value.length;
  }

  parseValue(value) {
    let entries = Object.entries(value);

    if (this.options.isReplacerAFunction()) {
      entries = entries.map(([key, value]) => [
        key,
        this.options.replacer(key, value),
      ]);
    }

    if (this.options.isReplacerAArray()) {
      entries = entries.filter(([key]) => this.options.replacer.includes(key));
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

    const [key, value] = this.value.shift();
    const next = `"${key}":${this.spaceEnd('') ? ' ' : ''}`;
    const nextElements = [this.newElement(value)];

    if (!this.isEmpty) {
      nextElements.push(this.newSpacedElement(','));
    }
    return this.state(next, nextElements);
  }
}

module.exports = { StackElement, StreamStackElement, jsonTypes };
