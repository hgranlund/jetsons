const { toStream, fibonacci } = require('./testUtils');
const { JsonStream } = require('../src');

const senario = (name, { input, replacer, expectedResult }) => {
  return [name, { input: () => input(), replacer, expectedResult }];
};

const legalSenarios = [
  senario('a Symbol', {
    input: () => Symbol(42),
    expectedResult: undefined,
  }),
  senario('a undefined value', {
    input: () => undefined,
    expectedResult: undefined,
  }),
  senario('a empty array', {
    input: () => [],
    expectedResult: [],
  }),
  senario('a string', {
    input: () => 'a string',
    expectedResult: 'a string',
  }),
  senario('a legal array with Number', {
    input: () => [1, 2, 3],
    expectedResult: [1, 2, 3],
  }),
  senario('a legal array with Number, string, null and boolean', {
    input: () => [1, 'aString', false, null],
    expectedResult: [1, 'aString', false, null],
  }),
  senario('a legal json with Number', {
    input: () => ({
      aKeyWithNumber: 1,
    }),
    expectedResult: {
      aKeyWithNumber: 1,
    },
  }),
  senario('a legal json with Infinity', {
    input: () => ({
      aKeyWithNumber: Infinity,
    }),
    expectedResult: {
      aKeyWithNumber: null,
    },
  }),
  senario('a legal json with Boolean', {
    input: () => ({
      aKeyWithBoolean: true,
    }),
    expectedResult: {
      aKeyWithBoolean: true,
    },
  }),
  senario('a legal json with String', {
    input: () => ({
      aKeyWithString: 'aString',
    }),
    expectedResult: {
      aKeyWithString: 'aString',
    },
  }),
  senario('a legal json with String and special chars', {
    input: () => ({
      aKeyWithString: 'line1\nline2\\\b\f\t\f\r"\u0000',
    }),
    expectedResult: {
      aKeyWithString: 'line1\nline2\\\b\f\t\f\r"\u0000',
    },
  }),
  senario('a legal json with number as String', {
    input: () => ({
      aKeyWithString: '1',
    }),
    expectedResult: {
      aKeyWithString: '1',
    },
  }),
  senario('a object with toJSON method', {
    input: () => ({
      aObjProp: '',
      toJSON: () => ({ toJSONProp: 'From toJSON method' }),
    }),
    expectedResult: { toJSONProp: 'From toJSON method' },
  }),
  senario('a legal json with boolean as String', {
    input: () => ({
      aKeyWithString: 'true',
    }),
    expectedResult: {
      aKeyWithString: 'true',
    },
  }),
  senario('a legal json with Unicode Character', {
    input: () => ({
      aKeyWithString: `\u007f#\u0600`,
    }),
    expectedResult: {
      aKeyWithString: `\u007f#\u0600`,
    },
  }),
  senario('a legal json with null, symbol, function and undefined value', {
    input: () => ({
      aKeyWithNull: null,
      aKeyWithUndefined: undefined,
      aKeyWithFunction: () => {},
      aKeyWithSymbol: Symbol(42),
    }),
    expectedResult: {
      aKeyWithNull: null,
    },
  }),
  senario('a legal json with String', {
    input: () => ({
      aKeyWithArray: [1, true, 'aSting'],
    }),
    expectedResult: {
      aKeyWithArray: [1, true, 'aSting'],
    },
  }),
  senario('a legal json with string, number and array', {
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
  senario('a legal json with nested json', {
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
  senario('a legal json with string stream', {
    input: () => ({
      aKeyWithStream: toStream('aValue'),
    }),
    expectedResult: {
      aKeyWithStream: 'aValue',
    },
  }),
  senario('a legal json with string stream with newline', {
    input: () => ({
      aKeyWithStream: toStream('aline\nAnotherline'),
    }),
    expectedResult: {
      aKeyWithStream: 'aline\nAnotherline',
    },
  }),
  senario('a legal json with raw stream', {
    input: () => ({
      aKeyWithStream: toStream('"aValue"', JsonStream.jsonTypes.raw),
    }),
    expectedResult: {
      aKeyWithStream: 'aValue',
    },
  }),
  senario('a legal json with object stream', {
    input: () => ({
      aKeyWithStream: toStream({ streamed: 'value' }),
    }),
    expectedResult: {
      aKeyWithStream: [{ streamed: 'value' }],
    },
  }),
  senario('a legal json with fibonacci as string stream', {
    input: () => ({
      aFibonacciStream: toStream(fibonacci(1, 9), JsonStream.jsonTypes.string),
    }),
    expectedResult: {
      aFibonacciStream: '1123581321',
    },
  }),
  senario('a legal json with fibonacci as string stream', {
    input: () => ({
      aFibonacciStream: toStream(
        fibonacci(1, 9, true),
        JsonStream.jsonTypes.array,
        {
          objectMode: false,
        },
      ),
    }),
    expectedResult: {
      aFibonacciStream: ['1', '1', '2', '3', '5', '8', '13', '21'],
    },
  }),
  senario('a legal json with fibonacci as array stream', {
    input: () => ({
      aFibonacciStream: toStream(fibonacci(1, 9), JsonStream.jsonTypes.array),
    }),
    expectedResult: {
      aFibonacciStream: [1, 1, 2, 3, 5, 8, 13, 21],
    },
  }),
  senario('a legal json with object array stream', {
    input: () => ({
      aArrayStream: toStream(
        [
          1,
          { key: 'string' },
          [1, 2, 3],
          false,
          Symbol(43),
          undefined,
          () => {},
        ],
        JsonStream.jsonTypes.array,
      ),
    }),
    expectedResult: {
      aArrayStream: [1, { key: 'string' }, [1, 2, 3], false, null, null, null],
    },
  }),
  senario('a legal json with fibonacci as raw stream', {
    input: () => ({
      aFibonacciStream: toStream(
        fibonacci(1, 9, true),
        JsonStream.jsonTypes.raw,
      ),
    }),
    expectedResult: {
      aFibonacciStream: 1123581321,
    },
  }),
  senario('a legal json with three fibonacci streams', {
    input: () => ({
      aFibonacciRawStream: toStream(
        fibonacci(1, 9, true),
        JsonStream.jsonTypes.raw,
      ),
      aFibonacciArrayStream: toStream(
        fibonacci(1, 9),
        JsonStream.jsonTypes.array,
      ),
      aFibonacciStringStream: toStream(
        fibonacci(1, 9),
        JsonStream.jsonTypes.string,
      ),
    }),
    expectedResult: {
      aFibonacciRawStream: 1123581321,
      aFibonacciArrayStream: [1, 1, 2, 3, 5, 8, 13, 21],
      aFibonacciStringStream: '1123581321',
    },
  }),
  senario('a legal json with promise', {
    input: () => ({
      aKeyWithPromise: Promise.resolve('aValue'),
    }),
    expectedResult: {
      aKeyWithPromise: 'aValue',
    },
  }),
  senario('a legal json with undefined', {
    input: () => ({
      aUndefinedKey: undefined,
    }),
    expectedResult: {},
  }),
  senario('a legal json with Date', {
    input: () => ({
      nodejsCreated: new Date('2009, 5, 27'),
    }),
    expectedResult: {
      nodejsCreated: new Date('2009, 5, 27').toISOString(),
    },
  }),
  senario('a json with key replacer function', {
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
  senario('a json with key replacer function', {
    input: () => ({
      aKeyToNotBeStringified: 'Value we dont wnat to see',
      aKeyToBeStringified: 'Value we want to see',
    }),
    replacer: ['aKeyToBeStringified'],
    expectedResult: {
      aKeyToBeStringified: 'Value we want to see',
    },
  }),
  senario('a json with json replacer function', {
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
  senario('a json with string replacer function', {
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

const getTestSenarios = (senarioNum = -1) => {
  if (senarioNum < 0) {
    return legalSenarios;
  } else {
    return legalSenarios.slice(senarioNum, senarioNum + 1);
  }
};

module.exports = {
  legalSenarios: getTestSenarios(),
};
