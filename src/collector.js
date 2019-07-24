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
      let strings = [];
      this.jsonStream
        .on('readable', () => {
          let data;
          while ((data = this.jsonStream.read())) {
            strings.push(data.toString());
          }
        })
        .on('end', () => {
          if (strings.length) {
            this.json = strings.join('');
          } else {
            this.json = undefined;
          }
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
        if (jsonString === undefined) {
          return jsonString;
        }
        return JSON.parse(jsonString);
      } catch (error) {
        error.message = `${error.message} \n ${jsonString}`;
        throw error;
      }
    });
  }
}

module.exports = Collector;
