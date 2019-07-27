const Benchmark = require('benchmark');
const { createReadStream, readFileSync } = require('fs');
const jetson = require('../src');

const { Writable } = require('stream');
// const JsonStreamStringify = require('../src/json-stream-json');
const JsonStreamStringify = require('json-stream-stringify');

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
    : jetson.toJson(obj());

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

const tests = [
  simpleJsonTest,
  simpleJsonOldTest,
  jsonWith4MBStringStream,
  jsonWith4MBStringStreamOld,
  hugeJsonTest,
  hugeJsonTestOld,
];

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
