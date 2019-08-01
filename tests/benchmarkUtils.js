const { readFileSync, writeFileSync } = require('fs');

const compareWithPrev = results => {
  writeFileSync(
    `tests/runs/performanceRun-${new Date().toISOString()}.json`,
    JSON.stringify(results),
  );
  const prevResults = JSON.parse(
    readFileSync(`tests/runs/performanceRun.json`),
  );
  if (prevResults) {
    const diffResult = results.map(result => {
      const prevResult = prevResults.find(
        prevResult => prevResult.name === result.name,
      );
      return compareWith(result, prevResult);
    });
    console.table(diffResult);
  }
};

const fixedTo = (value, descimals) => parseFloat(value.toFixed(descimals));

const compareWith = (newResult = {}, oldResult = {}) => {
  return Object.entries(newResult).reduce((result, [key, value]) => {
    if (['name', 'node'].includes(key)) {
      result[key] = value;
    } else if (key in oldResult) {
      result[key] = fixedTo(value - oldResult[key], 2);
    } else {
      result[key] = NaN;
    }
    return result;
  }, {});
};

const getResults = event => {
  return event.currentTarget.map(target => {
    const { hz, stats, name } = target;
    const count = stats.sample.length;
    const { mean, deviation, rme } = stats;
    return {
      name,
      count,
      'mean(ms)': (mean * 1000).toFixed(2),
      'deviation(ms)': (deviation * 1000).toFixed(2),
      'ops/sec': hz.toFixed(2),
      rme: rme.toFixed(2),
      node: process.versions.node,
    };
  });
};

module.exports = { compareWithPrev, getResults };
