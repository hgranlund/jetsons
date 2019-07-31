const Benchmark = require('benchmark');
const { createReadStream, readFileSync } = require('fs');
const { JsonStream } = require('../src');
const { devNullStream } = require('./testUtils');

const hugeJson = JSON.parse(readFileSync('tests/data/quotes.json'));

const runJsonStrimifyObject = obj => () => {
  const stream = new JsonStream(obj());

  return new Promise((resolve, reject) => {
    stream.on('end', resolve).on('error', reject);
    stream.pipe(devNullStream());
  });
};

const toPerformanceTest = (obj, name) => {
  const test = runJsonStrimifyObject(obj);
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

const tests = [simpleJsonTest, jsonWith4MBStringStream, hugeJsonTest];

tests
  .reduce(
    (suite, { name, test }) => suite.add(name, test),
    new Benchmark.Suite(),
  )
  .on('cycle', function(event) {
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  // run async
  .run({ async: true });
