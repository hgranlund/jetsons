const JsonStream = require('./streamify');

class Collector {
  constructor(value) {
    this.jsonStream = new JsonStream(value);
    this.json = '';
  }

  toJson() {
    if (this.json !== '') {
      Promise.resolve(this.json);
    }
    return new Promise((resolve, reject) => {
      let string = '';
      this.jsonStream
        .on('readable', () => {
          let data;
          while ((data = this.jsonStream.read())) {
            string += data.toString();
          }
        })
        .on('end', () => {
          this.json = string;
          resolve(this.json);
        })
        .on('error', error => {
          reject(error);
        });
    });
  }

  toObject() {
    return this.toJson().then(jsonString => JSON.parse(jsonString));
  }
}

module.exports = Collector;
