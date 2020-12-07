import { Stream } from 'stream';
import { JsonStream } from './jsonStream';

export enum JsonStreamType {
  STRING = 'string',
  ARRAY = 'array',
  RAW = 'raw',
}

export const setJsonStreamType = (stream: Stream, type: JsonStreamType): JsonStream => {
  const jsonStream = stream as JsonStream;
  jsonStream.jsonStreamType = type;
  return jsonStream;
};
