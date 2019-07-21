const { createReadStream, readFileSync } = require('fs');
const { toJson } = require('./testUtils');
const JsonStreamifyObject = require('../src');
const { PerformanceTest } = require('../../performaceTester/src');
const { Writable, Readable } = require('stream');
const JsonStreamStringify = require('../src/json-stream-json');
const hugeJson = JSON.parse(readFileSync('tests/data/quotes.json'));
const devNullStream = () =>
  Writable({
    write(chunk, encoding, done) {
      setImmediate(done);
    },
  });

const runJsonStrimifyObject = (obj, useOld = false) => () => {
  const stream = useOld
    ? new JsonStreamStringify(obj())
    : new JsonStreamifyObject(obj());

  return new Promise((resolve, reject) => {
    stream.on('end', resolve).on('error', reject);
    stream.pipe(devNullStream());
    // toJson(stream).then(json => {
    //   console.log(json);
    //   resolve();
    // });
  });
};

const toPerformanceTest = (obj, name, useOld = false) => {
  const test = runJsonStrimifyObject(obj, useOld);
  return new PerformanceTest(test, { name, async: true });
};

const simpleJsonTest = toPerformanceTest(
  () => ({
    test: 1,
    test2: 'test',
    test3: [1, 2, 3],
  }),
  'simpleJsonTest',
);

const simpleJsonOldTest = toPerformanceTest(
  () => ({
    test: 1,
    test2: 'test',
    test3: [1, 2, 3],
  }),
  'simpleJsonOldTest',
  true,
);

const jsonWith4MBStringStream = toPerformanceTest(
  () => ({
    lorem: createReadStream('tests/data/loremIpsum-4mb.txt'),
  }),
  'jsonWith4MBStringStream',
);

const jsonWith4MBStringStreamOld = toPerformanceTest(
  () => ({
    lorem: createReadStream('tests/data/loremIpsum-4mb.txt'),
  }),
  'jsonWith4MBStringStreamOld',
  true,
);
const hugeJsonTest = toPerformanceTest(() => hugeJson, 'hugeJson');
const hugeJsonTestOld = toPerformanceTest(
  () => hugeJson,
  'hugeJsonTestOld',
  true,
);

// const tests = [simpleJsonOldTest];
const tests = [
  simpleJsonTest,
  simpleJsonOldTest,
  jsonWith4MBStringStream,
  jsonWith4MBStringStreamOld,
  hugeJsonTest,
  hugeJsonTestOld,
];

tests
  .reduce(async (lastProm, test) => {
    await lastProm;
    return test.run(1);
  }, Promise.resolve())
  .then(() => {
    console.table(tests.map(test => test.result()));
  })
  .catch(error => {
    console.log(error);
  });
