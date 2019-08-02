require('jest-extended');
const { Readable } = require('stream');
const { legalSenarios } = require('./testSenarios');
const { JsonStream, Collector } = require('../src');
const { toStream } = require('./testUtils');

describe('Jetsons is loaded', () => {
  describe.each(legalSenarios)(
    'and a JsonStream on created on senario[%#]: %s',
    (name, senario) => {
      let stream;
      beforeAll(() => {
        const { input, replacer, space } = senario;
        stream = new JsonStream(input(), replacer, space);
      });

      it('should return a Readable stream', () => {
        expect(stream).toBeInstanceOf(Readable);
      });

      it('should not have started/ended', () => {
        expect(stream._readableState.ended).toBeFalsy();
        expect(stream._readableState.flowing).toBeFalsy();
      });
    },
  );

  describe.each(legalSenarios)(
    'and toObject on senario[%#]: %s',
    (_, senario) => {
      let object;

      beforeAll(async done => {
        const { input, replacer, space } = senario;
        const collector = new Collector(input(), replacer, space);
        object = await collector.toObject();
        done();
      });

      it('should return a expected output', () => {
        expect(object).toEqual(senario.expectedResult);
      });
    },
  );

  describe('and toJsonString on a value', () => {
    let value;
    let jsonString;

    beforeEach(async done => {
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

  describe('And the space parameter is used', () => {
    const testJson = {
      depth1: [1, 2, 3, 4, 5, 6, 7],
      nestedJson: { depth2: 2, nestedJson: { depth3: 3 } },
    };
    it('should default to emtpy space', async () => {
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
