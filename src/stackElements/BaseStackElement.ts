import { JsonStreamOptions } from '../jsonStreamOptions';
import { NextStackElement } from './types';

export class BaseStackElement {
  protected value: any;
  constructor(value: any, options = {} as JsonStreamOptions) {
    this.value = this.parseValue(value, options);
  }

  parseValue(value: any, _options?: JsonStreamOptions): any {
    return value;
  }

  async next(): Promise<NextStackElement> {
    return { next: this.value, elements: [], done: true };
  }
}
