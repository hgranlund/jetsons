import { Readable } from 'stream';
import { JsonStreamType } from '../streamType';
import {
  ArrayObjectStreamStackElement,
  ArrayStackElement,
  ArrayStreamStackElement,
  ObjectStackElement,
  PromiseStackElement,
  StreamStackElement,
  StringStreamStackElement,
} from './stackElements';
import {
  BooleanStackElement,
  NullStackElement,
  NumberStackElement,
  StringStackElement,
} from './PrimitiveStackElement';

export const getStackElementClass = (value: any) => {
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
      if (value instanceof Readable) {
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
      throw new Error(`type ${typeof value} - ${value} value can't be serialized in JSON`);
  }
};

const getStreamStackElementClass = (value: any) => {
  if ('jsonStreamType' in value && value.jsonStreamType) {
    switch (value.jsonStreamType) {
      case JsonStreamType.ARRAY:
        if (value.readableObjectMode) {
          return ArrayObjectStreamStackElement;
        } else {
          return ArrayStreamStackElement;
        }
      case JsonStreamType.RAW:
        return StreamStackElement;
      case JsonStreamType.STRING:
        return StringStreamStackElement;
      default:
        break;
    }
  }
  if (value.readableObjectMode) {
    return ArrayObjectStreamStackElement;
  } else {
    return StringStreamStackElement;
  }
};
