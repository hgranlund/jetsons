require('jest-extended');
const { Readable } = require('stream');
const { legalSenarios } = require('./testSenarios');
const { JSONStream, Collector } = require('../src');

describe('Streamier is loaded', () => {
  describe.each(legalSenarios)(
    'and toJson on senario[%#]: %s',
    (name, senario) => {
      let stream;
      beforeAll(() => {
        const { input, replacer, space } = senario;
        stream = new JSONStream(input(), replacer, space);
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
});
