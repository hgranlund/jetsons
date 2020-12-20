/* eslint-disable @typescript-eslint/no-empty-function */
import { JsonStreamType } from '../src';
import { Replacer, SpaceReplacement } from '../src/jsonStreamOptions';
import { fibonacci, toStream } from './testUtils';

export type ScenarioType = {
  input: () => any;
  replacer?: Replacer;
  space?: SpaceReplacement;
  expectedResult: any;
};

const scenario = (name: string, opt: ScenarioType): [string, ScenarioType] => {
  const { input, replacer, expectedResult } = opt;
  return [name, { input: () => input(), replacer, expectedResult }];
};

const noop = () => {};

const legalScenarios = [
  scenario('a Symbol', {
    input: () => Symbol(42),
    expectedResult: undefined,
  }),
  scenario('a undefined value', {
    input: () => undefined,
    expectedResult: undefined,
  }),
  scenario('a empty array', {
    input: () => [],
    expectedResult: [],
  }),
  scenario('a string', {
    input: () => 'a string',
    expectedResult: 'a string',
  }),
  scenario('a legal array with Number', {
    input: () => [1, 2, 3],
    expectedResult: [1, 2, 3],
  }),
  scenario('a legal array with Number, string, null and boolean', {
    input: () => [1, 'aString', false, null],
    expectedResult: [1, 'aString', false, null],
  }),
  scenario('a legal json with Number', {
    input: () => ({
      aKeyWithNumber: 1,
    }),
    expectedResult: {
      aKeyWithNumber: 1,
    },
  }),
  scenario('a legal json with Infinity', {
    input: () => ({
      aKeyWithNumber: Infinity,
    }),
    expectedResult: {
      aKeyWithNumber: null,
    },
  }),
  scenario('a legal json with Boolean', {
    input: () => ({
      aKeyWithBoolean: true,
    }),
    expectedResult: {
      aKeyWithBoolean: true,
    },
  }),
  scenario('a legal json with String', {
    input: () => ({
      aKeyWithString: 'aString',
    }),
    expectedResult: {
      aKeyWithString: 'aString',
    },
  }),
  scenario('a legal json with String and special chars', {
    input: () => ({
      aKeyWithString: 'line1\nline2\\\b\f\t\f\r"\u0000',
    }),
    expectedResult: {
      aKeyWithString: 'line1\nline2\\\b\f\t\f\r"\u0000',
    },
  }),
  scenario('a legal json with number as String', {
    input: () => ({
      aKeyWithString: '1',
    }),
    expectedResult: {
      aKeyWithString: '1',
    },
  }),
  scenario('a object with toJSON method', {
    input: () => ({
      aObjProp: '',
      toJSON: () => ({ toJSONProp: 'From toJSON method' }),
    }),
    expectedResult: { toJSONProp: 'From toJSON method' },
  }),
  scenario('a legal json with boolean as String', {
    input: () => ({
      aKeyWithString: 'true',
    }),
    expectedResult: {
      aKeyWithString: 'true',
    },
  }),
  scenario('a legal json with Unicode Character', {
    input: () => ({
      aKeyWithString: `\u007f#\u0600`,
    }),
    expectedResult: {
      aKeyWithString: `\u007f#\u0600`,
    },
  }),
  scenario('a legal json with null, symbol, function and undefined value', {
    input: () => ({
      aKeyWithNull: null,
      aKeyWithUndefined: undefined,
      aKeyWithFunction: noop,
      aKeyWithSymbol: Symbol(42),
    }),
    expectedResult: {
      aKeyWithNull: null,
    },
  }),
  scenario('a legal json with String', {
    input: () => ({
      aKeyWithArray: [1, true, 'aSting'],
    }),
    expectedResult: {
      aKeyWithArray: [1, true, 'aSting'],
    },
  }),
  scenario('a legal json with string, number and array', {
    input: () => ({
      aKeyWithString: 'aValue',
      aKeyWithNumber: 1,
      aKeyWithArray: [1, 2, 3],
    }),
    expectedResult: {
      aKeyWithString: 'aValue',
      aKeyWithNumber: 1,
      aKeyWithArray: [1, 2, 3],
    },
  }),
  scenario('a legal json with nested json', {
    input: () => ({
      aKeyWithString: 'aValue',
      aKeyWithNumber: 1,
      aKeyWithObject: {
        aKeyWithString: 'aValue',
        aKeyWithNumber: 1,
      },
    }),
    expectedResult: {
      aKeyWithString: 'aValue',
      aKeyWithNumber: 1,
      aKeyWithObject: {
        aKeyWithString: 'aValue',
        aKeyWithNumber: 1,
      },
    },
  }),
  scenario('a legal json with string stream', {
    input: () => ({
      aKeyWithStream: toStream('aValue'),
    }),
    expectedResult: {
      aKeyWithStream: 'aValue',
    },
  }),
  scenario('a legal json with string stream with newline', {
    input: () => ({
      aKeyWithStream: toStream('aline\nAnotherline'),
    }),
    expectedResult: {
      aKeyWithStream: 'aline\nAnotherline',
    },
  }),
  scenario('a legal json with raw stream', {
    input: () => ({
      aKeyWithStream: toStream('"aValue"', JsonStreamType.RAW),
    }),
    expectedResult: {
      aKeyWithStream: 'aValue',
    },
  }),
  scenario('a legal json with object stream', {
    input: () => ({
      aKeyWithStream: toStream({ streamed: 'value' }),
    }),
    expectedResult: {
      aKeyWithStream: [{ streamed: 'value' }],
    },
  }),
  scenario('a legal json with fibonacci as string stream', {
    input: () => ({
      aFibonacciStream: toStream(fibonacci(1, 9), JsonStreamType.STRING),
    }),
    expectedResult: {
      aFibonacciStream: '1123581321',
    },
  }),
  scenario('a legal json with fibonacci as string stream', {
    input: () => ({
      aFibonacciStream: toStream(fibonacci(1, 9, true), JsonStreamType.ARRAY, {
        objectMode: true,
      }),
    }),
    expectedResult: {
      aFibonacciStream: ['1', '1', '2', '3', '5', '8', '13', '21'],
    },
  }),
  scenario('a legal json with fibonacci as array stream', {
    input: () => ({
      aFibonacciStream: toStream(fibonacci(1, 9), JsonStreamType.ARRAY),
    }),
    expectedResult: {
      aFibonacciStream: [1, 1, 2, 3, 5, 8, 13, 21],
    },
  }),
  scenario('a legal json with object array stream', {
    input: () => ({
      aArrayStream: toStream(
        [1, { key: 'string' }, [1, 2, 3], false, Symbol(43), undefined, noop],
        JsonStreamType.ARRAY,
      ),
    }),
    expectedResult: {
      aArrayStream: [1, { key: 'string' }, [1, 2, 3], false, null, null, null],
    },
  }),
  scenario('a legal json with fibonacci as raw stream', {
    input: () => ({
      aFibonacciStream: toStream(fibonacci(1, 9, true), JsonStreamType.RAW),
    }),
    expectedResult: {
      aFibonacciStream: 1123581321,
    },
  }),
  scenario('a legal json with three fibonacci streams', {
    input: () => ({
      aFibonacciRawStream: toStream(fibonacci(1, 9, true), JsonStreamType.RAW),
      aFibonacciArrayStream: toStream(fibonacci(1, 9), JsonStreamType.ARRAY),
      aFibonacciStringStream: toStream(fibonacci(1, 9), JsonStreamType.STRING),
    }),
    expectedResult: {
      aFibonacciRawStream: 1123581321,
      aFibonacciArrayStream: [1, 1, 2, 3, 5, 8, 13, 21],
      aFibonacciStringStream: '1123581321',
    },
  }),
  scenario('a legal json with promise', {
    input: () => ({
      aKeyWithPromise: Promise.resolve('aValue'),
    }),
    expectedResult: {
      aKeyWithPromise: 'aValue',
    },
  }),
  scenario('a legal json with undefined', {
    input: () => ({
      aUndefinedKey: undefined,
    }),
    expectedResult: {},
  }),
  scenario('a legal json with Date', {
    input: () => ({
      nodejsCreated: new Date('2009, 5, 27'),
    }),
    expectedResult: {
      nodejsCreated: new Date('2009, 5, 27').toISOString(),
    },
  }),
  scenario('a json with key replacer function', {
    input: () => ({
      aKeyToNotBeReplaced: 'Original Value',
      aKeyToBeReplaced: 'Original Value',
    }),
    replacer: (key, value) => {
      if (key === 'aKeyToBeReplaced') {
        return 'A Replaced Value';
      }
      return value;
    },
    expectedResult: {
      aKeyToNotBeReplaced: 'Original Value',
      aKeyToBeReplaced: 'A Replaced Value',
    },
  }),
  scenario('a json with key replacer function', {
    input: () => ({
      aKeyToNotBeStringified: 'Value we dont want to see',
      aKeyToBeStringified: 'Value we want to see',
    }),
    replacer: ['aKeyToBeStringified'],
    expectedResult: {
      aKeyToBeStringified: 'Value we want to see',
    },
  }),
  scenario('a json with json replacer function', {
    input: () => ({
      toBeReplaced: 'Original Value',
    }),
    replacer: (key, value) => {
      if (key === '') {
        return { replacedKey: 123 };
      }
      return value;
    },
    expectedResult: { replacedKey: 123 },
  }),
  scenario('a json with string replacer function', {
    input: () => ({
      toBeReplaced: 'Original Value',
    }),
    replacer: (key, value) => {
      if (key === '') {
        return 123;
      }
      return value;
    },
    expectedResult: 123,
  }),
];

export const getTestScenarios = (scenarioNum = -1) => {
  if (scenarioNum < 0) {
    return legalScenarios;
  } else {
    return legalScenarios.slice(scenarioNum, scenarioNum + 1);
  }
};
