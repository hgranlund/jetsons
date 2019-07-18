const { inspect } = require('util');
const toJson = stream => {
  return new Promise((resolve, reject) => {
    const strings = [];
    stream
      .on('readable', () => {
        let data;
        while ((data = stream.read())) {
          strings.push(data.toString());
        }
      })
      .on('end', () => {
        try {
          resolve(JSON.parse(strings.join('')));
        } catch (error) {
          reject(
            new Error(`${error.message}
            ${inspect(strings.join(''))}`),
          );
        }
      })
      .on('error', error => {
        reject(error);
      });
  });
};

module.exports = { toJson };
