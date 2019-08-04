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
    this._value = this.parseValue(value, options);
  }

  parseValue(value) {
    return value;
  }

  next() {
    return { next: this._value, elements: [], done: true };
  }
}

class StackElement extends SimpleStackElement {
  constructor(value, options, depth) {
    super(value, options);
    this._options = options;
    this._isComplete = false;
    this._depth = depth;
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
    return char + this._options.space(this._depth);
  }

  spaceEnd(char) {
    return this._options.space(this._depth) + char;
  }

  newSpacedElement(char, start = true) {
    return new SimpleStackElement(
      start ? this.spaceStart(char) : this.spaceEnd(char),
    );
  }

  newElement(value, depth = this._depth) {
    return StackElement.factory(value, this._options, depth);
  }

  completed() {
    this.debug('Completed');
  }

  nextState(next, elements = [], done = false) {
    return { next, elements, done };
  }

  next() {
    this.completed();
    return this.nextState(this._value, [], true);
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
    this._state = states.waiting;
    this._rejections = new Set();
    this.initValidate();
    this._value
      .on('error', error => this.handleError(error))
      .on('end', () => {
        this._state = states.ended;
      });
  }

  handleError(error) {
    this._state = states.error;
    this._error = error;
    this._rejections.forEach(reject => reject(error));
  }

  endState() {
    return this.nextState(null, [], true);
  }

  firstState() {
    return null;
  }

  initValidate() {
    if (
      this._value._readableState.ended &&
      this._value._readableState.endEmitted
    ) {
      this.handleError(
        new Error('Readable Stream has already ended. Unable to process it!'),
      );
    } else if (this._value._readableState.flowing) {
      this.handleError(
        new Error('Readable Stream is in flowing mode, data may be lost'),
      );
    }
  }

  untilReadable() {
    let eventListener = null;
    const promise = new Promise((resolve, reject) => {
      eventListener = () => {
        this._state = states.readable;
        this._rejections.delete(reject);
        eventListener = null;
        resolve();
      };
      this._value.once('readable', eventListener);
      this._rejections.add(reject);
    });

    const cleanup = () => {
      if (eventListener == null) return;
      this._value.removeListener('readable', eventListener);
    };

    return { cleanup, promise };
  }

  untilEnd() {
    let eventListener = null;

    const promise = new Promise((resolve, reject) => {
      eventListener = () => {
        this._state = states.ended;
        this._rejections.delete(reject);
        eventListener = null;
        resolve();
      };
      this._value.once('end', eventListener);
      this._rejections.add(reject);
    });

    const cleanup = () => {
      if (eventListener == null) return;
      this._value.removeListener('end', eventListener);
    };

    return { cleanup, promise };
  }

  nextWhenReadable() {
    const chunck = this._value.read();
    if (chunck !== null) {
      return this.nextState(chunck);
    } else {
      this._state = states.waiting;
      return this.next();
    }
  }

  nextWhenWaiting() {
    const read = this.untilReadable();
    const end = this.untilEnd();
    const cleanUp = () => [read, end].forEach(v => v.cleanup());
    return Promise.race([read.promise, end.promise])
      .then(() => {
        cleanUp();
        return this.next();
      })
      .catch(error => {
        cleanUp();
        throw error;
      });
  }

  next() {
    switch (this._state) {
      case states.readable:
        return this.nextWhenReadable();
      case states.waiting:
        return this.nextWhenWaiting();
      case states.ended:
        this.completed();
        return this.endState();
      case states.first:
        this._state = states.waiting;
        return this.firstState();
      case states.error:
        throw this._error;
      default:
        throw new Error(
          `Illegal state ${this._state} in ${this.constructor.name}`,
        );
    }
  }

  end() {
    if (this._state !== states.ended || this._state !== states.error) {
      this.debug('Closing stream');
      endStream(this._value);
    }
  }
}

class ArrayStreamStackElement extends StreamStackElement {
  constructor(...args) {
    super(...args);
    this._secondStateSendt = false;
    this._depth++;
    if (this._state !== states.error) {
      this._state = states.first;
    }
  }

  endState() {
    this._depth--;
    return { next: this.spaceEnd(']'), elements: [], done: true };
  }

  firstState() {
    return { next: this.spaceStart('['), elements: [], done: false };
  }

  nextState(next, elements = []) {
    if (next === null) {
      return { next: null, elements, done: false };
    }
    if (!this._secondStateSendt) {
      this._secondStateSendt = true;
      return { next: quote(next.toString()), elements, done: false };
    } else {
      return {
        next: `${this.spaceStart(',')}${quote(next.toString())}`,
        elements,
        done: false,
      };
    }
  }
}

class StringStreamStackElement extends StreamStackElement {
  constructor(value, options, depth) {
    super(value, options, depth);
    if (this._state !== states.error) {
      this._state = states.first;
    }
  }

  endState() {
    return { next: '"', elements: [], done: true };
  }

  firstState() {
    return { next: '"', elements: [], done: false };
  }

  nextWhenReadable() {
    let chunck = this._value.read();
    if (chunck !== null) {
      return this.nextState(escapeString(chunck.toString()));
    } else {
      this._state = states.waiting;
      return this.next();
    }
  }
}

class ArrayObjectStreamStackElement extends ArrayStreamStackElement {
  nextWhenReadable() {
    const chunck = this._value.read();
    if (chunck !== null) {
      if (this._secondStateSendt) {
        return this.nextState(null, [
          this.newSpacedElement(','),
          this.newElement(chunck),
        ]);
      } else {
        this._secondStateSendt = true;
        return this.nextState(null, [this.newElement(chunck)]);
      }
    } else {
      this._state = states.waiting;
      return this.next();
    }
  }
}

class PromiseStackElement extends StackElement {
  async next() {
    const result = await this._value;
    this.completed();
    return this.nextState(null, [this.newElement(result)], true);
  }
}

class ArrayStackElement extends StackElement {
  constructor(value, options, depth) {
    super(value, options, depth);
    this.atIndex = -1;
    this._depth++;
  }

  next() {
    if (this.atIndex === -1) {
      this.atIndex++;
      return this.nextState(this.spaceStart('['));
    }
    const nextElements = [];
    if (this._value.length - 1 > this.atIndex) {
      const to = Math.min(this._value.length - 1, this.atIndex + 1000);
      while (this.atIndex < to) {
        nextElements.push(this.newElement(this._value[this.atIndex]));
        nextElements.push(this.newSpacedElement(','));
        this.atIndex++;
      }
    }

    if (this._value.length - 1 === this.atIndex) {
      nextElements.push(this.newElement(this._value[this.atIndex]));
      this.atIndex++;
    }

    if (this._value.length === this.atIndex) {
      this._depth--;
      nextElements.push(this.newSpacedElement(']', false));
      this.completed();
      return this.nextState(null, nextElements, true);
    }
    return this.nextState(null, nextElements);
  }
}

class ObjectStackElement extends StackElement {
  constructor(value, options, depth) {
    super(value, options, depth);
    this._first = true;
    this._depth++;
  }

  get isEmpty() {
    return !this._value.length;
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

  next() {
    if (this._first) {
      this._first = false;
      return this.nextState(this.spaceStart('{'));
    }
    if (this.isEmpty) {
      this.completed();
      this._depth--;
      return this.nextState(this.spaceEnd('}'), [], true);
    }

    const [key, value] = this._value.shift();
    const next = `"${key}":${this.spaceEnd('') ? ' ' : ''}`;
    const nextElements = [this.newElement(value)];

    if (!this.isEmpty) {
      nextElements.push(this.newSpacedElement(','));
    }
    return this.nextState(next, nextElements);
  }
}

module.exports = { StackElement, StreamStackElement };
