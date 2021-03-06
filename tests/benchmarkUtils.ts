// tslint:disable: no-console
import { Event } from 'benchmark';
import fs, { readFileSync, writeFileSync } from 'fs';

export const compareWithPrev = (rawResults: Event) => {
  const results = getResults(rawResults);
  console.log('# Current results:');
  console.table(results);

  writeFileSync(
    `tests/runs/performanceRun-${new Date().toISOString()}.json`,
    JSON.stringify(results),
  );

  const path = `tests/runs/performanceRun.json`;

  if (fs.existsSync(path)) {
    const prevResults = JSON.parse(readFileSync(path).toString());
    if (prevResults) {
      console.log('# Previous run:');
      console.table(prevResults);
      const theDiff = Object.entries(results).reduce((diff, [key, result]) => {
        diff[key] = compareWith(result, prevResults[key]);
        return diff;
      }, {});
      console.log('# Diff (current-previous): ');
      console.table(theDiff);
    }
  }
  if (process.argv[2] === 'write') {
    writeFileSync(`tests/runs/performanceRun.json`, JSON.stringify(results));
    console.log('Previous result updated');
  }
};

const fixedTo = (value: number, decimals: number) => parseFloat(value.toFixed(decimals));

const compareWith = (newResult = {}, oldResult = {}) => {
  return Object.entries(newResult).reduce((result, [key, value]: [string, number]) => {
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

export const getResults = (event: any) => {
  return event.currentTarget.reduce((result, target) => {
    const { hz, stats, name } = target;
    const count = stats.sample.length;
    const { mean, deviation, rme } = stats;
    result[name.replace(/\.*/g, '')] = {
      count: Number(count),
      'mean(ms)': fixedTo(mean * 1000, 2),
      'deviation(ms)': fixedTo(deviation * 1000, 2),
      'ops/sec': fixedTo(hz, 2),
      rme: fixedTo(rme, 2),
      node: process.versions.node,
    };
    return result;
  }, {});
};
