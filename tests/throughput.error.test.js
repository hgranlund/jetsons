require('jest-extended');
const { toStream, devNullStream } = require('./testUtils');

describe('Throughput is loaded', () => {
  let throughput;
  beforeAll(() => {
    throughput = require('../src');
  });

  describe('When stream is in illegal state', () => {
    const endedStream = toStream('value');

    beforeAll(() => {
      return new Promise(resolve => {
        endedStream.on('end', resolve);
        endedStream.pipe(devNullStream());
      });
    });
    it('should return error hen object contains an ended stream', () => {
      expect(throughput.toJson([endedStream])).toReject();
      expect(throughput.toObject([endedStream])).toReject();
    });

    it('should return error hen object contains an stream in flowing state', () => {
      const flowingStream = toStream('value');
      flowingStream.pipe(devNullStream());
      expect(throughput.toJson([flowingStream])).toReject();
      expect(throughput.toObject([flowingStream])).toReject();
    });
  });
});
