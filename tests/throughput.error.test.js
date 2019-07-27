require('jest-extended');
const { toStream, devNullStream } = require('./testUtils');
const { Collector } = require('../src');
process.on('unhandledRejection', error => {
  console.error(error);
});
describe('Jetson is loaded', () => {
  describe('And if stream has ended', () => {
    let endedStream = toStream('value');

    beforeAll(done => {
      endedStream.on('end', done);
      endedStream.pipe(devNullStream());
    });

    it('should return error when object contains an ended stream', () => {
      const collector = new Collector([endedStream]);

      const expectedError = new Error(
        'Readable Stream has already ended. Unable to process it!',
      );
      expect(collector.toObject()).rejects.toEqual(expectedError);
      expect(collector.toJson()).rejects.toEqual(expectedError);
    });

    it('should return error is stream already has ended', () => {
      const collector = new Collector(endedStream);

      const expectedError = new Error(
        'Readable Stream has already ended. Unable to process it!',
      );
      expect(collector.toObject()).rejects.toEqual(expectedError);
      expect(collector.toJson()).rejects.toEqual(expectedError);
    });
  });

  describe('And someone else is processing the stream', () => {
    const expectedError = new Error(
      'ReadabelStream is in flowing mode, data may be lost',
    );

    it('should return error if stream is in flowing state before initializatoin', () => {
      const flowingStream = toStream('value');
      flowingStream.pipe(devNullStream());

      const collector = new Collector(flowingStream);
      expect(collector.toJson()).rejects.toEqual(expectedError);
      expect(collector.toObject()).rejects.toEqual(expectedError);
    });

    it('should return error if stream inside structure is in flowing state before initializatoin', () => {
      const flowingStream = toStream('value');
      flowingStream.pipe(devNullStream());

      const collector = new Collector([flowingStream]);
      expect(collector.toJson()).rejects.toEqual(expectedError);
      expect(collector.toObject()).rejects.toEqual(expectedError);
    });

    it('should return error if stream starts flowing during processing', () => {
      const flowingStream = toStream('value');
      const collector = new Collector(flowingStream);

      flowingStream.pipe(devNullStream());
      expect(collector.toJson()).rejects.toEqual(expectedError);
      expect(collector.toObject()).rejects.toEqual(expectedError);
    });

    it('should return error if stream inside structure starts flowing during processing', () => {
      const flowingStream = toStream('value');
      const collector = new Collector([flowingStream]);

      flowingStream.pipe(devNullStream());
      expect(collector.toJson()).rejects.toEqual(expectedError);
      expect(collector.toObject()).rejects.toEqual(expectedError);
    });
  });
  describe('And unsupported types are used', () => {
    it('should throw TypeError if a BigInt in encounterd', () => {
      // eslint-disable-next-line no-undef
      const collector = new Collector({ aBigInt: BigInt(42) });
      const expectedError = new Error(
        `BigInt value can't be serialized in JSON`,
      );
      expect(collector.toJson()).rejects.toEqual(expectedError);
    });
  });
});
