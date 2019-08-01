const Benchmark = require('benchmark');
const { createReadStream, readFileSync } = require('fs');
const { devNullStream } = require('./testUtils');
const { JsonStream } = require('../src');
const hugeJson = JSON.parse(readFileSync('tests/data/quotes.json'));
const { compareWithPrev, getResults } = require('./benchmarkUtils');

const toPerformanceTest = (obj, name) => {
  const test = deferred => {
    const stream = new JsonStream(obj());
    stream
      .on('end', () => deferred.resolve())
      .on('error', () => deferred.resolve());
    stream.pipe(devNullStream());
  };
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

const ha100k = Array.from(Array.from(new Array(100000)));
const hugeArray100kTest = toPerformanceTest(() => ha100k, 'hugeArray100k');

const ha10k = Array.from(Array.from(new Array(10000)));
const hugeArray10kTest = toPerformanceTest(() => ha10k, 'hugeArray10k');

const tests = [
  simpleJsonTest,
  jsonWith4MBStringStream,
  hugeJsonTest,
  hugeArray10kTest,
  hugeArray100kTest,
];

tests
  .reduce((suite, { name, test }) => {
    suite.add(name, test, { defer: true });
    return suite;
  }, new Benchmark.Suite())
  .on('cycle', function(event) {
    console.log(String(event.target));
  })
  .on('complete', event => {
    const results = getResults(event);
    console.table(results);
    const diff = compareWithPrev(results);
    if (diff) {
      console.table(diff);
    }
  })
  .run();
