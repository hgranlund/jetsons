import { StackElementType } from './stackElements';

export interface JsonStreamError extends Error {
  jsonStreamStack: StackElementType[];
}
