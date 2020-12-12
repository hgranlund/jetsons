import { quote } from '../utils';
import { BaseStackElement } from './BaseStackElement';

export class StringStackElement extends BaseStackElement {
  protected value: string;

  parseValue(value: string): string {
    return quote(value);
  }
}

export class BooleanStackElement extends BaseStackElement {
  protected value: string;

  parseValue(aBoolean: boolean): 'true' | 'false' {
    return aBoolean ? 'true' : 'false';
  }
}
export class NullStackElement extends BaseStackElement {
  protected value: string;

  parseValue(): string {
    return 'null';
  }
}

export class NumberStackElement extends BaseStackElement {
  protected value: string;

  parseValue(value: number): string {
    if (Number.isFinite(value)) {
      return String(value);
    } else {
      return 'null';
    }
  }
}
