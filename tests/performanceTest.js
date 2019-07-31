const { createReadStream, readFileSync, writeFileSync } = require('fs');
const { devNullStream } = require('./testUtils');
const { JsonStream } = require('../src');
const { PerformanceTest } = require('../../performaceTester/src');
const hugeJson = JSON.parse(readFileSync('tests/data/quotes.json'));

const runJsonStrimifyObject = obj => () => {
  return new Promise((resolve, reject) => {
    const stream = new JsonStream(obj());
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

const jsonWith4MBStringStream = toPerformanceTest(
  () => ({
    lorem: createReadStream('tests/data/loremIpsum-4mb.txt'),
  }),
  'jsonWith4MBStringStream',
);

const hugeJsonTest = toPerformanceTest(() => hugeJson, 'hugeJson');

const ha = Array.from(Array.from(new Array(100000)));
const hugeArrayTest = toPerformanceTest(() => ha, 'hugeArray');

const tests = [
  simpleJsonTest,
  jsonWith4MBStringStream,
  hugeJsonTest,
  hugeArrayTest,
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
    performanceTests.map(test => {
      const prevResult = prevResults.find(result => result.name === test.name);
      return test.compareWith(prevResult);
    }),
  );
};
