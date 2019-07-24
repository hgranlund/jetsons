require('jest-extended');
const { toStream, devNullStream } = require('./testUtils');
const { Collector } = require('../src');
process.on('unhandledRejection', error => {
  console.error(error);
});
describe('Streamier is loaded', () => {
  describe('When stream is in illegal state', () => {
    let endedStream = toStream('value');

    beforeAll(done => {
      endedStream.on('end', done);
      endedStream.pipe(devNullStream());
    });

    it('should return error hen object contains an ended stream', () => {
      const collector = new Collector(endedStream);

      expect(collector.toJson()).toReject();
      expect(collector.toObject()).toReject();
    });

    it('should return error hen object contains an stream in flowing state', done => {
      const flowingStream = toStream('value');
      const collector = new Collector(flowingStream);
      flowingStream.pipe(devNullStream());
      setImmediate(() => {
        expect(collector.toJson()).toResolve();
        expect(collector.toObject()).toResolve();
        done();
      });
    });
  });
});
