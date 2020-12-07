import debugInit from 'debug';
import Denque from 'denque';
import { Readable, ReadableOptions } from 'stream';
import { inspect } from 'util';
import { JsonStreamError } from './JsonStreamError';
import { JsonStreamOptions, Replacer, SpaceReplacement } from './jsonStreamOptions';
import {
  NextStackElement,
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
    streamOpt?: ReadableOptions,
  ) {
    super(streamOpt);
    this.stack = new Denque();
    this.state = StreamState.WAITING;
    debug(`Created`);

    const options = new JsonStreamOptions(replacer, space);
    this.addFirstStackElement(options.initReplace(value), options);

    this.on('close', () => this.onClose());
  }

  addFirstStackElement(value: any, options: JsonStreamOptions) {
    const shouldReturnUndefined = ['function', 'undefined', 'symbol'].includes(typeof value);
    if (!shouldReturnUndefined) {
      this.stack.push(StackElement.factory(value, options));
    }
  }

  async _read(size = 32384): Promise<void> {
    if (this.stack.isEmpty()) {
      if (this.state !== StreamState.ENDED) {
        this.state = StreamState.ENDED;
        this.push(null);
        debug('Completed');
      }
    } else if (this.state !== StreamState.WAITING) {
      if (this.isInState(StreamState.READING)) {
        this.state = StreamState.READ_WHILE_READING;
      }
      return null;
    } else {
      this.state = StreamState.READING;
      try {
        await this.processStack(size);
        if (this.isInState(StreamState.READ_WHILE_READING)) {
          setImmediate(() => this._read());
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

  async processStack(size: number): Promise<void> {
    if (this.stack.isEmpty() || size <= 0) {
      return Promise.resolve();
    }
    const element = this.stack.peekFront();
    const next = element.next();
    if (next instanceof Promise) {
      const n = await next;
      return this.handleNext(n, size);
    } else {
      return this.handleNext(next, size);
    }
  }

  handleNext({ next, elements, done }: NextStackElement, size: number) {
    if (done) {
      this.stack.shift();
    }
    if (elements.length) {
      elements.reverse().forEach((element) => this.stack.unshift(element));
    }
    if (next !== null) {
      const buffer = Buffer.from(next);
      if (this.push(buffer)) {
        return this.processStack(size - buffer.length);
      } else {
        return Promise.resolve();
      }
    } else {
      return this.processStack(size);
    }
  }

  handleError(error: JsonStreamError) {
    const newError = error;
    newError.jsonStreamStack = this.stack.toArray();
    debug(
      error,
      '\nWhile processing stack:',
      inspect(newError.jsonStreamStack, { maxArrayLength: 15 }),
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
