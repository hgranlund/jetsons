require('jest-extended');
const { Readable } = require('stream');
const { legalSenarios } = require('./testSenarios');

describe('Throughput is loaded', () => {
  let throughput;
  beforeAll(() => {
    throughput = require('../src');
  });

  describe.each(legalSenarios)(
    'and toJsonStream on senario[%#]: %s',
    (name, senario) => {
      let stream;
      beforeAll(() => {
        stream = throughput.toJsonStream(senario.input());
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
      let result;
      beforeAll(async () => {
        result = await throughput.toObject(senario.input());
      });

      it('should return a expected output', () => {
        expect(result).toMatchObject(senario.expectedResult);
      });
    },
  );

  describe.each(legalSenarios)(
    'and toJson on senario[%#]: %s',
    (name, senario) => {
      let jsonString;
      beforeAll(() => {
        return throughput.toJson(senario.input()).then(json => {
          jsonString = json;
        });
      });

      it('should return a string', () => {
        expect(jsonString).toBeString();
      });

      it('should return a expected json string', () => {
        const parsedJson = JSON.parse(jsonString);
        expect(parsedJson).toMatchObject(senario.expectedResult);
      });
    },
  );
});
