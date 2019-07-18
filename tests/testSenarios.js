const intoStream = require('into-stream');

const senario = (name, { input, expectedResult }) => {
  return [name, { input, expectedResult }];
};

const legalSenarios = [
  senario('a legal json with Number', {
    input: {
      aKeyWithNumber: 1,
    },
    expectedResult: {
      aKeyWithNumber: 1,
    },
  }),
  senario('a legal json with Boolean', {
    input: {
      aKeyWithBoolean: true,
    },
    expectedResult: {
      aKeyWithBoolean: true,
    },
  }),
  senario('a legal json with String', {
    input: {
      aKeyWithString: 'aString',
    },
    expectedResult: {
      aKeyWithString: 'aString',
    },
  }),
  senario('a legal json with number as String', {
    input: {
      aKeyWithString: '1',
    },
    expectedResult: {
      aKeyWithString: '1',
    },
  }),
  senario('a legal json with String', {
    input: {
      aKeyWithArray: [1, true, 'aSting'],
    },
    expectedResult: {
      aKeyWithArray: [1, true, 'aSting'],
    },
  }),
  senario('a legal json with string, number and array', {
    input: {
      aKeyWithString: 'aValue',
      aKeyWithNumber: 1,
      aKeyWithArray: [1, 2, 3],
    },
    expectedResult: {
      aKeyWithString: 'aValue',
      aKeyWithNumber: 1,
      aKeyWithArray: [1, 2, 3],
    },
  }),
  senario('a legal json with nested json', {
    input: {
      aKeyWithString: 'aValue',
      aKeyWithNumber: 1,
      aKeyWithObject: {
        aKeyWithString: 'aValue',
        aKeyWithNumber: 1,
      },
    },
    expectedResult: {
      aKeyWithString: 'aValue',
      aKeyWithNumber: 1,
      aKeyWithObject: {
        aKeyWithString: 'aValue',
        aKeyWithNumber: 1,
      },
    },
  }),
  // senario('a legal json with string stream', {
  //   input: {
  //     aKeyWithStream: intoStream('aValue'),
  //   },
  //   expectedResult: {
  //     aKeyWithStream: 'aValue',
  //   },
  // }),
  // senario('a legal json with object stream', {
  //   input: {
  //     aKeyWithStream: intoStream({ streamed: 'value' }),
  //   },
  //   expectedResult: {
  //     aKeyWithStream: { streamed: 'value' },
  //   },
  // }),
  // senario('a legal json with promise', {
  //   input: {
  //     aKeyWithPromise: Promise.resolve('aValue'),
  //   },
  //   expectedResult: {
  //     aKeyWithPromise: 'aValue',
  //   },
  // }),
];

module.exports = { legalSenarios };
