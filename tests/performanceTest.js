const { createReadStream, readFileSync, writeFileSync } = require('fs');
const { toJson, fibonacci, devNullStream } = require('./testUtils');
const throughput = require('../src');
const { PerformanceTest } = require('../../performaceTester/src');
const JsonStreamStringify = require('json-stream-stringify');

const hugeJson = JSON.parse(readFileSync('tests/data/quotes.json'));

const runJsonStrimifyObject = (obj, useOld = false) => () => {
  const stream = useOld
    ? new JsonStreamStringify(obj())
    : throughput.toJson(obj());

  return new Promise((resolve, reject) => {
    stream.on('end', resolve).on('error', reject);
    stream.pipe(devNullStream());
  });
};

const toPerformanceTest = (obj, name, useOld = false) => {
  const test = runJsonStrimifyObject(obj, useOld);
  return { name, test };
};

const simpleJsonTest = toPerformanceTest(
  () => ({
    test: 1,
    test2: 'test',
    test3: [1, 2, 3],
  }),
  'simpleJsonTest',
);

const simpleJsonTestOld = toPerformanceTest(
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

const hugeArrayTest = toPerformanceTest(
  () => Array.from(fibonacci(100000)),
  'hugeArray',
);
const hugeArrayTestOld = toPerformanceTest(
  () => Array.from(fibonacci(100000)),
  'hugeArrayOld',
  true,
);

const tests = [
  simpleJsonTest,
  // simpleJsonTestOld,
  jsonWith4MBStringStream,
  // jsonWith4MBStringStreamOld,
  hugeJsonTest,
  // hugeJsonTestOld,
  hugeArrayTest,
  // hugeArrayTestOld,
];

const performanceTests = tests.map(
  ({ name, test }) => new PerformanceTest(test, { name, async: true }),
);
performanceTests
  .reduce(async (lastProm, test) => {
    await lastProm;
    return test.run(50);
  }, Promise.resolve())
  .then(() => {
    const results = performanceTests.map(test => test.result());
    handleResults(results);
  })
  .catch(error => {
    console.log(error);
  });

const testEquals = () => {
  const testEqualResult = async obj => {
    const oldJson = await toJson(new JsonStreamStringify(obj()));
    const newJson = await toJson(new JsonStreamifyObject(obj()));
    if (JSON.stringify(oldJson) != JSON.stringify(newJson)) {
      console.error('new and old are not equal');
    }
  };
  testEqualResult(() => ({
    test: 1,
    test2: 'test',
    test3: [1, 2, 3],
  }));

  testEqualResult(() => ({
    lorem: createReadStream('tests/data/loremIpsum-4mb.txt'),
  }));

  testEqualResult(() => Array.from(fibonacci(100000)));
  testEqualResult(() => ({
    lorem: createReadStream('tests/data/loremIpsum-4mb.txt'),
  }));
};

const handleResults = results => {
  console.table(results);
  writeFileSync(
    `tests/runs/performanceRun-${new Date().toISOString()}.json`,
    JSON.stringify(results),
  );
  const prevResults = JSON.parse(
    readFileSync(`tests/runs/performanceRun.json`),
  );
  console.table(
    performanceTests.map((test, i) => {
      const prevResult = prevResults[i];
      return test.compareWith(prevResult);
    }),
  );
};
// testEquals();
