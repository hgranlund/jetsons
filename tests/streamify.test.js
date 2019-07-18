require('jest-extended');
const { legalSenarios } = require('./testSenarios');
const { toJson } = require('./testUtils');

describe('Streamify is loaded', () => {
  let Streamify;
  beforeAll(() => {
    Streamify = require('../src');
  });

  describe.each(legalSenarios)(
    'and we are streamifying: %s',
    (name, senario) => {
      let result;
      beforeAll(async () => {
        const jsonStream = new Streamify(senario.input);
        try {
          result = await toJson(jsonStream);
        } catch (error) {
          expect(error).toBeUndefined();
        }
      });

      it('should return a expected output', () => {
        expect(result).toMatchObject(senario.expectedResult);
      });
    },
  );
});
