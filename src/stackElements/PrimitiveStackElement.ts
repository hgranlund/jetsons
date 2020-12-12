import { quote } from '../utils';
import { StackElementType } from './types';

const toStackElement = (nextValue: string): StackElementType => {
  const next = () => {
    return { next: nextValue, elements: [], done: true };
  };
  return { next };
};

export const toStringStackElement = (value: string) => {
  return toStackElement(quote(value));
};
export const toBooleanStackElement = (aBoolean: boolean) => {
  return toStackElement(aBoolean ? 'true' : 'false');
};
export const toNumberStackElement = (aNumber: number) => {
  return toStackElement(Number.isFinite(aNumber) ? String(aNumber) : 'null');
};
export const toNullStackElement = () => {
  return toStackElement('null');
};
