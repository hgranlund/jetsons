/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import debugInit from 'debug';
import Denque from 'denque';
import { Readable, ReadableOptions } from 'stream';
import { setImmediate } from 'timers';
import { inspect } from 'util';
import { JsonStreamError } from './JsonStreamError';
import {
  JsonStreamOptions,
  Replacer,
  SpaceReplacement,
} from './jsonStreamOptions';
import {
  StackElement,
  StackElementType,
  StreamStackElement,
} from './stackElements';
import { JsonStreamType } from './streamType';

const debug = debugInit('jetsons:JsonStream');
enum StreamState {
  WAITING,
  READ_WHILE_READING,
  READING,
  ENDED,
  ERROR,
}

export class JsonStream extends Readable {
  private stack: Denque<StackElementType>;
  protected state: StreamState;
  jsonStreamType: JsonStreamType;
  constructor(
    value: any,
    replacer?: Replacer,
    space?: SpaceReplacement,
    streamOpt?: ReadableOptions
  ) {
    super(streamOpt);
    this.stack = new Denque();
    this.state = StreamState.WAITING;
    debug(`Created`);

    const options = new JsonStreamOptions(replacer, space);
    this.addFirstStackElement(options.initReplace(value), options);

    this.on('close', () => this.onClose());
  }

  addFirstStackElement(value: any, options: JsonStreamOptions): void {
    const shouldReturnUndefined = ['function', 'undefined', 'symbol'].includes(
      typeof value
    );
    if (!shouldReturnUndefined) {
      this.stack.push(StackElement.factory(value, options));
    }
  }

  async _read(size = 16192): Promise<void> {
    if (this.stack.isEmpty()) {
      if (!this.isInState(StreamState.ENDED)) {
        this.state = StreamState.ENDED;
        this.push(null);
        debug('Completed');
      }
    } else if (!this.isInState(StreamState.WAITING)) {
      if (this.isInState(StreamState.READING)) {
        this.state = StreamState.READ_WHILE_READING;
      }
      return null;
    } else {
      this.state = StreamState.READING;
      try {
        const shouldContinue = await this.processStack(size);
        if (shouldContinue || this.isInState(StreamState.READ_WHILE_READING)) {
          setImmediate(() => this._read(size));
        }
        this.state = StreamState.WAITING;
      } catch (error) {
        this.handleError(error);
      }
    }
  }

  protected isInState(state: StreamState): boolean {
    return this.state === state;
  }

  async processStack(size: number): Promise<boolean> {
    if (this.stack.isEmpty() || size <= 0) {
      return Promise.resolve(true);
    }
    let nextToPush = '';
    while (nextToPush.length < size && !this.stack.isEmpty()) {
      const stackElement = this.stack.peekFront();
      let nextStackElement = stackElement.next(size - nextToPush.length);
      if (nextStackElement instanceof Promise) {
        nextStackElement = await nextStackElement;
      }
      const { next, elements, done } = nextStackElement;
      if (done) {
        this.stack.shift();
      }
      if (elements.length) {
        elements.reverse().forEach((element) => this.stack.unshift(element));
      }
      if (next !== null) {
        nextToPush += next;
      }
    }
    if (nextToPush.length > 0) {
      return this.push(nextToPush);
    }
    return true;
  }

  handleError(error: Error) {
    const newError = error as JsonStreamError;
    newError.jsonStreamStack = this.stack.toArray();
    debug(
      error,
      '\nWhile processing stack:',
      inspect(newError.jsonStreamStack, { maxArrayLength: 15 })
    );
    this.state = StreamState.ERROR;
    setImmediate(() => this.emit('error', error));
  }

  onClose() {
    debug('JsonStream closed');
    this.stack
      .toArray()
      .filter((item) => item instanceof StreamStackElement)
      .forEach((item: StreamStackElement) => item.end());
  }
}
