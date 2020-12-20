import { Readable } from 'stream';
import { StackElementType } from './types';
import { JsonStream } from '../jsonStream';
import { JsonStreamOptions } from '../jsonStreamOptions';
import { JsonStreamType } from '../streamType';
import {
  toBooleanStackElement,
  toNullStackElement,
  toNumberStackElement,
  toStringStackElement,
} from './PrimitiveStackElement';
import {
  ArrayObjectStreamStackElement,
  ArrayStackElement,
  ArrayStreamStackElement,
  ObjectStackElement,
  PromiseStackElement,
  StreamStackElement,
  StringStreamStackElement,
} from './stackElements';

export const getStackElement = (
  value: any,
  options: JsonStreamOptions,
  depth: number
): StackElementType => {
  switch (typeof value) {
    case 'number':
      return toNumberStackElement(value);
    case 'boolean':
      return toBooleanStackElement(value);
    case 'string':
      return toStringStackElement(value);
    case 'undefined':
      return toNullStackElement();
    case 'object':
      if (value === null) return toNullStackElement();
      if (Array.isArray(value))
        return new ArrayStackElement(value, options, depth);
      if (value instanceof Readable) {
        return getStreamStackElement(value, options, depth);
      }
      if (value instanceof Promise || typeof value.then === 'function') {
        return new PromiseStackElement(value, options, depth);
      }
      return new ObjectStackElement(value, options, depth);
    case 'symbol':
      return toNullStackElement();
    case 'function':
      return toNullStackElement();
    case 'bigint':
      throw new Error(`BigInt value can't be serialized in JSON`);
    default:
      throw new Error(
        `type ${typeof value} - ${value} value can't be serialized in JSON`
      );
  }
};

const getStreamStackElement = (
  value: Readable | JsonStream,
  options: JsonStreamOptions,
  depth: number
) => {
  if ('jsonStreamType' in value && value.jsonStreamType) {
    switch (value.jsonStreamType) {
      case JsonStreamType.ARRAY:
        if (value.readableObjectMode) {
          return new ArrayObjectStreamStackElement(value, options, depth);
        } else {
          return new ArrayStreamStackElement(value, options, depth);
        }
      case JsonStreamType.RAW:
        return new StreamStackElement(value, options, depth);
      case JsonStreamType.STRING:
        return new StringStreamStackElement(value, options, depth);
      default:
        break;
    }
  }
  if (value.readableObjectMode) {
    return new ArrayObjectStreamStackElement(value, options, depth);
  } else {
    return new StringStreamStackElement(value, options, depth);
  }
};
