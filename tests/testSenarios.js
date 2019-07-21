const { toStream } = require('./testUtils');

const senario = (name, { input, expectedResult }) => {
  return [name, { input: () => input(), expectedResult }];
};

const legalSenarios = [
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
      aKeyWithString: 'line1\nline2',
    }),
    expectedResult: {
      aKeyWithString: 'line1\nline2',
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
  senario('a legal json with null value', {
    input: () => ({
      aKeyWithString: null,
    }),
    expectedResult: {
      aKeyWithString: null,
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
  senario('a legal json with navite stream', {
    input: () => ({
      aKeyWithStream: toStream('"aValue"', true),
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
      aKeyWithStream: { streamed: 'value' },
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
];

module.exports = { legalSenarios };
