require('jest-extended');
const { Readable } = require('stream');
const { legalSenarios } = require('./testSenarios');
const { JsonStream, Collector } = require('../src');
const { toStream, devNullStream } = require('./testUtils');

describe('Jetsons is loaded', () => {
  describe.each(legalSenarios)(
    'and toJson on senario[%#]: %s',
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
    (name, senario) => {
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

  describe.each(legalSenarios)(
    'and toJsonString on senario[%#]: %s',
    (name, senario) => {
      let jsonString;

      beforeAll(async done => {
        const { input, replacer, space } = senario;
        const collector = new Collector(input(), replacer, space);
        try {
          jsonString = await collector.toJson();
        } catch (error) {
          console.error(`${error.message} \n ${error.jsonString}`);
        }
        done();
      });

      it('should return a expected json string', () => {
        try {
          if (!senario.expectedResult) {
            expect(jsonString).toEqual(senario.expectedResult);
          } else {
            const parsedJson = JSON.parse(jsonString);
            expect(parsedJson).toEqual(senario.expectedResult);
          }
        } catch (error) {
          error.message = `${error.message} \n ${jsonString}`;
          throw error;
        }
      });
    },
  );

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
  });

  describe('And JsonStream is aborted/closed', () => {
    it('should propagate close to streams on stack', done => {
      let output = '';
      const streamToBeEnded = toStream(
        new Promise(resolve => {
          setTimeout(() => {
            resolve('Returned after 2s');
          }, 500);
        }),
      ).on('close', () => {
        expect(output).not.toContain('Returned after 2s');
        done();
      });
      const jsonStream = new JsonStream([streamToBeEnded]);
      jsonStream
        .on('data', data => {
          output += data.toString();
        })
        .pipe(devNullStream());
      setTimeout(() => {
        jsonStream.destroy();
      }, 100);
    });
  });
});
