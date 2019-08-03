const debug = require('debug')('jetsons:StackElements');
const { Stream } = require('stream');
const { quote, escapeString, endStream } = require('./utils');
const { jsonTypes } = require('./constants');

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
      return BooleanStackElement;
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

class SimpleStackElement {
  constructor(value, options) {
    this.value = this.parseValue(value, options);
  }

  parseValue(value) {
    return value;
  }

  async next() {
    return { next: this.value, elements: [], done: true };
  }
}

class StackElement extends SimpleStackElement {
  constructor(value, options, depth) {
    super(value, options);
    this.options = options;
    this._isComplete = false;
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
    return new SimpleStackElement(
      start ? this.spaceStart(char) : this.spaceEnd(char),
    );
  }

  newElement(value, depth = this.depth) {
    return StackElement.factory(value, this.options, depth);
  }

  completed() {
    this.debug('Completed');
  }

  state(next, elements = [], done = false) {
    return { next, elements, done };
  }

  async next() {
    this.completed();
    return this.state(this.value, [], true);
  }

  debug(msg) {
    debug(`${this.constructor.name}: ${msg}`);
  }
}

class StringStackElement extends SimpleStackElement {
  parseValue(value) {
    return quote(value);
  }
}

class BooleanStackElement extends SimpleStackElement {
  parseValue(boolean) {
    return boolean ? 'true' : 'false';
  }
}
class NullStackElement extends SimpleStackElement {
  parseValue() {
    return 'null';
  }
}

class NumberStackElement extends SimpleStackElement {
  parseValue(value) {
    if (Number.isFinite(value)) {
      return String(value);
    } else {
      return 'null';
    }
  }
}

const states = {
  first: Symbol('first'),
  waiting: Symbol('waiting'),
  readable: Symbol('readable'),
  ended: Symbol('ended'),
  error: Symbol('error'),
};

class StreamStackElement extends StackElement {
  constructor(...args) {
    super(...args);
    this._inState = states.waiting;
    this._rejections = new Set();
    this.initValidate();
    this.value
      .on('error', error => this.handleError(error))
      .on('end', () => {
        this._inState = states.ended;
      });
  }

  handleError(error) {
    this._inState = states.error;
    this._error = error;
    this._rejections.forEach(reject => reject(error));
  }

  endState() {
    return this.state(null, [], true);
  }

  firstState() {
    return null;
  }

  initValidate() {
    if (
      this.value._readableState.ended &&
      this.value._readableState.endEmitted
    ) {
      this.handleError(
        new Error('Readable Stream has already ended. Unable to process it!'),
      );
    } else if (this.value._readableState.flowing) {
      this.handleError(
        new Error('Readable Stream is in flowing mode, data may be lost'),
      );
    }
  }

  untilReadable() {
    let eventListener = null;
    const promise = new Promise((resolve, reject) => {
      eventListener = () => {
        this._inState = states.readable;
        this._rejections.delete(reject);
        eventListener = null;
        resolve();
      };
      this.value.once('readable', eventListener);
      this._rejections.add(reject);
    });

    const cleanup = () => {
      if (eventListener == null) return;
      this.value.removeListener('readable', eventListener);
    };

    return { cleanup, promise };
  }

  untilEnd() {
    let eventListener = null;

    const promise = new Promise((resolve, reject) => {
      eventListener = () => {
        this._inState = states.ended;
        this._rejections.delete(reject);
        eventListener = null;
        resolve();
      };
      this.value.once('end', eventListener);
      this._rejections.add(reject);
    });

    const cleanup = () => {
      if (eventListener == null) return;
      this.value.removeListener('end', eventListener);
    };

    return { cleanup, promise };
  }

  nextWhenReadable() {
    const chunck = this.value.read();
    if (chunck !== null) {
      return this.state(chunck);
    } else {
      this._inState = states.waiting;
      return this.next();
    }
  }

  async nextWhenWaiting() {
    const read = this.untilReadable();
    const end = this.untilEnd();
    try {
      await Promise.race([read.promise, end.promise]);
      return this.next();
    } finally {
      read.cleanup();
      end.cleanup();
    }
  }

  async next() {
    this.validateOnNext();
    switch (this._inState) {
      case states.readable:
        return this.nextWhenReadable();
      case states.waiting:
        return this.nextWhenWaiting();
      case states.ended:
        this.completed();
        return this.endState();
      case states.first:
        this._inState = states.waiting;
        return this.firstState();
      case states.error:
        throw this._error;
      default:
        throw new Error(
          `Illegal state ${this._inState} in ${this.constructor.name}`,
        );
    }
  }

  validateOnNext() {
    if (this.value._readableState.flowing) {
      this.handleError(
        new Error('Readable Stream is in flowing mode, data may be lost'),
      );
    }
  }

  end() {
    if (this._inState !== states.ended || this._inState !== states.error) {
      this.debug('Closing stream');
      endStream(this.value);
    }
  }
}

class ArrayStreamStackElement extends StreamStackElement {
  constructor(...args) {
    super(...args);
    this._secondStateSendt = false;
    this.depth++;
    if (this._inState !== states.error) {
      this._inState = states.first;
    }
  }

  endState() {
    this.depth--;
    return super.state(this.spaceEnd(']'), [], true);
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
    if (this._inState !== states.error) {
      this._inState = states.first;
    }
  }

  endState() {
    return super.state('"', [], true);
  }

  firstState() {
    return super.state(null, [new SimpleStackElement('"')]);
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
    const result = await this.value;
    this.completed();
    return this.state(null, [this.newElement(result)], true);
  }
}

class ArrayStackElement extends StackElement {
  constructor(value, options, depth) {
    super(value, options, depth);
    this.atIndex = -1;
    this.depth++;
  }

  async next() {
    if (this.atIndex === -1) {
      this.atIndex++;
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
      return this.state(null, nextElements, true);
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

  parseValue(value, options) {
    let entries = Object.entries(value);

    if (options.isReplacerAFunction()) {
      entries = entries.map(([key, value]) => [
        key,
        options.replacer(key, value),
      ]);
    }

    if (options.isReplacerAArray()) {
      entries = entries.filter(([key]) => options.replacer.includes(key));
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
      return this.state(this.spaceEnd('}'), [], true);
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
