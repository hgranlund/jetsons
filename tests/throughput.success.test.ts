import 'jest-extended';
import { Readable } from 'stream';
import { Collector, JsonStream, JsonStreamType } from '../src';
import { getTestScenarios } from './testScenarios';
import { fibonacci, toStream } from './testUtils';

const legalScenarios = getTestScenarios();
describe('Jetsons is loaded', () => {
  describe.each(legalScenarios)(
    'and a JsonStream on created on scenario[%#]: %s',
    (name, scenario) => {
      let stream: Readable;
      beforeAll(() => {
        const { input, replacer, space } = scenario;
        stream = new JsonStream(input(), replacer, space);
      });

      it('should return a Readable stream', () => {
        expect(stream).toBeInstanceOf(Readable);
      });

      it('should not have started/ended', () => {
        expect(stream.readableEnded).toBeFalsy();
        expect(stream.readableFlowing).toBeFalsy();
      });
    }
  );

  describe.each(legalScenarios)(
    'and toObject on scenario[%#]: %s',
    (_, scenario) => {
      let object;

      beforeAll(async (done) => {
        const { input, replacer, space } = scenario;
        const collector = new Collector(input(), replacer, space);
        object = await collector.toObject();
        done();
      });

      it('should return a expected output', () => {
        expect(object).toEqual(scenario.expectedResult);
      });
    }
  );

  describe('and toJsonString on a value', () => {
    let value;
    let jsonString;

    beforeEach(async (done) => {
      value = { aKeyWithArray: [1, true, 'aSting'] };
      const collector = new Collector(value, null, '');
      try {
        jsonString = await collector.toJson();
      } catch (error) {
        console.error(`${error.message} \n ${error.jsonString}`);
      }
      done();
    });

    it('should return a expected json string', () => {
      const expectedJsonString = JSON.stringify(value, null, '');
      expect(jsonString).toEqual(expectedJsonString);
    });
  });

  describe('should handle small highWatermark opt', () => {
    const testInput = {
      aFibonacciStream: toStream(
        fibonacci(1, 20, true),
        JsonStreamType.STRING,
        { objectMode: false, highWaterMark: 2 }
      ),
    };
    const expectedResult = {
      aFibonacciStream: '1123581321345589144233377610987159725844181',
    };
    it('should give expected result', async () => {
      const json = await new Collector(testInput, null, null, {
        highWaterMark: 2,
      }).toJson();
      const expectedJson = JSON.stringify(expectedResult);
      expect(json).toEqual(expectedJson);
    });
  });

  describe('And the space parameter is used', () => {
    const testJson = {
      depth1: [1, 2, 3, 4, 5, 6, 7],
      nestedJson: { depth2: 2, nestedJson: { depth3: 3 } },
    };
    it('should default to empty space', async () => {
      const json = await new Collector(testJson).toJson();
      const expectedJson = JSON.stringify(testJson);
      expect(json).toEqual(expectedJson);
    });
    it('should handle # as space', async () => {
      const json = await new Collector(testJson, null, '#').toJson();
      const expectedJson = JSON.stringify(testJson, null, '#');
      expect(json).toEqual(expectedJson);
    });
    it('should handle long string as space', async () => {
      const json = await new Collector(testJson, null, '12345678912').toJson();
      const expectedJson = JSON.stringify(testJson, null, '12345678912');
      expect(json).toEqual(expectedJson);
    });
    it('should handle number 2 as space', async () => {
      const json = await new Collector(testJson, null, 2).toJson();
      const expectedJson = JSON.stringify(testJson, null, 2);
      expect(json).toEqual(expectedJson);
    });
    it('should handle number 5 as space', async () => {
      const json = await new Collector(testJson, null, 5).toJson();
      const expectedJson = JSON.stringify(testJson, null, 5);
      expect(json).toEqual(expectedJson);
    });
    it('should handle number bigger then 10 as space', async () => {
      const json = await new Collector(testJson, null, 50).toJson();
      const expectedJson = JSON.stringify(testJson, null, 50);
      expect(json).toEqual(expectedJson);
    });

    it('should handle number 5 as space with array stream', async () => {
      const testjsonWithStream = {
        ...testJson,
        depth1: toStream(testJson.depth1),
      };
      const json = await new Collector(testjsonWithStream, null, 5).toJson();
      const expectedJson = JSON.stringify(testJson, null, 5);
      expect(json).toEqual(expectedJson);
    });
  });
});
