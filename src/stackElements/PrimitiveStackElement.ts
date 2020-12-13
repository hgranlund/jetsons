import { quote } from '../utils';
import { StackElementType } from './types';

export const toPrimitiveStackElement = (nextValue: string): StackElementType => {
  const next = () => {
    return { next: nextValue, elements: [], done: true };
  };
  return { next };
};

export const toStringStackElement = (value: string) => {
  return toPrimitiveStackElement(quote(value));
};
export const toBooleanStackElement = (aBoolean: boolean) => {
  return toPrimitiveStackElement(aBoolean ? 'true' : 'false');
};
export const toNumberStackElement = (aNumber: number) => {
  return toPrimitiveStackElement(Number.isFinite(aNumber) ? String(aNumber) : 'null');
};
export const toNullStackElement = () => {
  return toPrimitiveStackElement('null');
};
