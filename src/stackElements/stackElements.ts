// tslint:disable: max-classes-per-file
import debugInit from 'debug';
import { Readable } from 'stream';
import { JsonStreamOptions } from '../jsonStreamOptions';
import { endStream, escapeString, quote } from '../utils';
import { BaseStackElement } from './BaseStackElement';
import { getStackElement } from './stackElementFactory';
import { NextStackElement, StackElementType } from './types';
import { noop } from './utils';
const debug = debugInit('jetsons:StackElements');

export class StackElement extends BaseStackElement {
  private options: JsonStreamOptions;
  protected isComplete: boolean;
  depth: number;
  constructor(value: any, options = {} as JsonStreamOptions, depth = 0) {
    super(value, options);
    this.options = options;
    this.isComplete = false;
    this.depth = depth;
    debug('Created');
  }

  static factory(value: any, options: JsonStreamOptions, depth = 0): StackElementType {
    if (value && value.toJSON instanceof Function) {
      value = value.toJSON();
    }
    return getStackElement(value, options, depth);
  }

  spaceStart(char: string): string {
    return char + this.options.spaceFn(this.depth);
  }

  spaceEnd(char: string): string {
    return this.options.spaceFn(this.depth) + char;
  }

  newSpacedElement(char: string, start = true): BaseStackElement {
    return new BaseStackElement(start ? this.spaceStart(char) : this.spaceEnd(char));
  }

  newElement(value: any, depth = this.depth): StackElementType {
    return StackElement.factory(value, this.options, depth);
  }

  completed(): void {
    debug('Completed');
  }

  nextState(next: any, elements = [], done = false): NextStackElement {
    return { next, elements, done };
  }

  async next(): Promise<NextStackElement> {
    this.completed();
    return this.nextState(this.value, [], true);
  }

  debug(msg: string): void {
    debug(`${this.constructor.name}: ${msg}`);
  }
}

export class ObjectStackElement extends StackElement {
  protected _first: boolean;
  protected value: [any, any][];

  constructor(value: Record<any, any>, options: JsonStreamOptions, depth: number) {
    super(value, options, depth);
    this._first = true;
    this.depth++;
  }

  get isEmpty() {
    return !this.value.length;
  }

  parseValue(value: any, options: JsonStreamOptions): [string, unknown][] {
    let entries = Object.entries(value);
    const replacer = options?.replacer;
    if (typeof replacer === 'function') {
      entries = entries.map(([key, entryValue]) => [key, replacer(key, entryValue)]);
    }

    if (Array.isArray(replacer)) {
      entries = entries.filter(([key]) => replacer.includes(key));
    }

    return entries.filter(([, entryValue]) => this.shouldValueBeStringified(entryValue));
  }

  shouldValueBeStringified(value: any): boolean {
    const type = typeof value;
    return value !== undefined && type !== 'function' && type !== 'symbol';
  }

  async next(): Promise<NextStackElement> {
    if (this._first) {
      this._first = false;
      return this.nextState(this.spaceStart('{'));
    }
    if (this.isEmpty) {
      this.completed();
      this.depth--;
      return this.nextState(this.spaceEnd('}'), [], true);
    }

    const [key, value] = this.value.shift();
    const next = `"${key}":${this.spaceEnd('') ? ' ' : ''}`;
    const nextElements = [this.newElement(value)];

    if (!this.isEmpty) {
      nextElements.push(this.newSpacedElement(','));
    }
    return this.nextState(next, nextElements);
  }
}

export class PromiseStackElement extends StackElement {
  async next(): Promise<NextStackElement> {
    const result = await this.value;
    this.completed();
    return this.nextState(null, [this.newElement(result)], true);
  }
}

export class ArrayStackElement extends StackElement {
  atIndex = -1;
  constructor(value: any, options: JsonStreamOptions, depth: number) {
    super(value, options, depth);
    this.depth++;
  }

  async next(): Promise<NextStackElement> {
    if (this.atIndex === -1) {
      this.atIndex++;
      return this.nextState(this.spaceStart('['));
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
      return this.nextState(null, nextElements, true);
    }
    return this.nextState(null, nextElements);
  }
}

export enum StreamStackElementState {
  FIRST,
  WAITING,
  READABLE,
  ENDED,
  ERROR,
}
export class StreamStackElement extends StackElement {
  protected value: Readable;

  protected state: StreamStackElementState;
  protected rejections: Set<(reason: any) => void>;
  protected error: Error;
  constructor(value: Readable, options: JsonStreamOptions, depth: number) {
    super(value, options, depth);
    this.state = StreamStackElementState.WAITING;
    this.rejections = new Set();
    this.initValidate();
    this.value
      .on('error', (error) => this.handleError(error))
      .on('end', () => {
        this.state = StreamStackElementState.ENDED;
      });
  }

  handleError(error: Error): void {
    this.state = StreamStackElementState.ERROR;
    this.error = error;
    this.rejections.forEach((reject) => reject(error));
  }

  endState(): NextStackElement {
    return this.nextState(null, [], true);
  }

  firstState(): any {
    return null;
  }

  initValidate(): void {
    if (this.value.readableEnded) {
      this.handleError(new Error('Readable Stream has already ended. Unable to process it!'));
    } else if (this.value.readableFlowing) {
      this.handleError(new Error('Readable Stream is in flowing mode, data may be lost'));
    }
  }

  untilReadable(): { cleanup: () => void; promise: Promise<void> } {
    let eventListener = null;
    let cleanUpReject = noop;
    const promise = new Promise<void>((resolve, reject) => {
      cleanUpReject = () => {
        if (this.rejections.has(reject)) {
          this.rejections.delete(reject);
        }
      };
      eventListener = () => {
        this.state = StreamStackElementState.READABLE;
        cleanUpReject();
        eventListener = null;
        resolve();
      };
      this.value.once('readable', eventListener);
      this.rejections.add(reject);
    });

    const cleanup = () => {
      cleanUpReject();
      if (eventListener == null) return;
      this.value.removeListener('readable', eventListener);
    };

    return { cleanup, promise };
  }

  untilEnd(): { cleanup: () => void; promise: Promise<void> } {
    let eventListener = null;
    let cleanUpReject = noop;
    const promise = new Promise<void>((resolve, reject) => {
      cleanUpReject = () => {
        if (this.rejections.has(reject)) {
          this.rejections.delete(reject);
        }
      };
      eventListener = () => {
        this.state = StreamStackElementState.ENDED;
        cleanUpReject();
        eventListener = null;
        resolve();
      };
      this.value.once('end', eventListener);
      this.rejections.add(reject);
    });

    const cleanup = () => {
      cleanUpReject();
      if (eventListener == null) return;
      this.value.removeListener('end', eventListener);
    };

    return { cleanup, promise };
  }

  nextWhenReadable(): Promise<NextStackElement> | NextStackElement {
    const chunk = this.value.read();
    if (chunk !== null) {
      return this.nextState(chunk);
    } else {
      this.state = StreamStackElementState.WAITING;
      return this.next();
    }
  }

  async nextWhenWaiting(): Promise<NextStackElement> {
    const read = this.untilReadable();
    const end = this.untilEnd();
    const cleanUp = () => [read, end].forEach((v) => v.cleanup());
    try {
      await Promise.race([read.promise, end.promise]);
      cleanUp();
      return this.next();
    } catch (error) {
      cleanUp();
      throw error;
    }
  }

  async next(): Promise<NextStackElement> {
    switch (this.state) {
      case StreamStackElementState.READABLE:
        return this.nextWhenReadable();
      case StreamStackElementState.WAITING:
        return this.nextWhenWaiting();
      case StreamStackElementState.ENDED:
        this.completed();
        return this.endState();
      case StreamStackElementState.FIRST:
        this.state = StreamStackElementState.WAITING;
        return this.firstState();
      case StreamStackElementState.ERROR:
        throw this.error;
      default:
        throw new Error(`Illegal state ${this.state} in ${this.constructor.name}`);
    }
  }

  end(): void {
    if (![StreamStackElementState.ENDED, StreamStackElementState.ERROR].includes(this.state)) {
      debug('Closing stream');
      endStream(this.value);
    }
  }
}

export class ArrayStreamStackElement extends StreamStackElement {
  protected _secondStateSent: boolean;
  constructor(value: any, options: JsonStreamOptions, depth: number) {
    super(value, options, depth);
    this._secondStateSent = false;
    this.depth++;
    if (this.state !== StreamStackElementState.ERROR) {
      this.state = StreamStackElementState.FIRST;
    }
  }

  endState(): NextStackElement {
    this.depth--;
    return { next: this.spaceEnd(']'), elements: [], done: true };
  }

  firstState(): NextStackElement {
    return { next: this.spaceStart('['), elements: [], done: false };
  }

  nextState(next: string, elements = []): NextStackElement {
    if (next === null) {
      return { next: null, elements, done: false };
    }
    if (!this._secondStateSent) {
      this._secondStateSent = true;
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

export class ArrayObjectStreamStackElement extends ArrayStreamStackElement {
  async nextWhenReadable(): Promise<NextStackElement> {
    const chunk = this.value.read();
    if (chunk !== null) {
      if (this._secondStateSent) {
        return this.nextState(null, [this.newSpacedElement(','), this.newElement(chunk)]);
      } else {
        this._secondStateSent = true;
        return this.nextState(null, [this.newElement(chunk)]);
      }
    } else {
      this.state = StreamStackElementState.WAITING;
      return this.next();
    }
  }
}

export class StringStreamStackElement extends StreamStackElement {
  constructor(value: Readable, options: JsonStreamOptions, depth: number) {
    super(value, options, depth);
    if (this.state !== StreamStackElementState.ERROR) {
      this.state = StreamStackElementState.FIRST;
    }
  }

  endState(): NextStackElement {
    return { next: '"', elements: [], done: true };
  }

  firstState(): NextStackElement {
    return { next: '"', elements: [], done: false };
  }

  async nextWhenReadable(): Promise<NextStackElement> {
    const chunk = this.value.read();
    if (chunk !== null) {
      return this.nextState(escapeString(chunk.toString()));
    } else {
      this.state = StreamStackElementState.WAITING;
      return this.next();
    }
  }
}
