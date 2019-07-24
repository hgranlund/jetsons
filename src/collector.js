const JsonStream = require('./jsonStream');

class Collector {
  constructor(value) {
    this.jsonStream = new JsonStream(value);
    this.json = '';
  }

  toJson() {
    if (this.json instanceof Promise) {
      return this.json;
    }
    if (this.json !== '') {
      Promise.resolve(this.json);
    }
    this.json = new Promise((resolve, reject) => {
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
    return this.json;
  }

  toObject() {
    return this.toJson().then(jsonString => {
      try {
        return JSON.parse(jsonString);
      } catch (error) {
        error.jsonString = jsonString;
        throw error;
      }
    });
  }
}

module.exports = Collector;
