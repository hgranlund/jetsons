import { Readable } from 'stream';

export enum JsonStreamType {
  STRING = 'string',
  ARRAY = 'array',
  RAW = 'raw',
}

export interface JsonTypedStream extends Readable {
  jsonStreamType: JsonStreamType;
}

export const setJsonStreamType = (
  stream: Readable,
  type: JsonStreamType
): JsonTypedStream => {
  const jsonStream = stream as JsonTypedStream;
  jsonStream.jsonStreamType = type;
  return jsonStream;
};
