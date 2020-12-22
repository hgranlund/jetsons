import { ReadableOptions } from 'stream';
import { JsonStream } from './jsonStream';
import { Replacer } from './jsonStreamOptions';

export class Collector extends JsonStream {
  json: string | Promise<string>;
  constructor(
    value: any,
    replacer?: Replacer,
    space?: string | number,
    opt?: ReadableOptions
  ) {
    super(value, replacer, space, opt);
    this.json = '';
  }

  toJson(): Promise<string> {
    if (this.json instanceof Promise) {
      return this.json;
    }
    if (this.json !== '') {
      Promise.resolve(this.json);
    }
    this.json = new Promise((resolve, reject) => {
      const strings = [] as string[];
      this.on('readable', () => {
        let data = this.read();
        while (data) {
          strings.push(data.toString());
          data = this.read();
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
        .on('error', (error) => {
          reject(error);
        });
    });
    return this.json;
  }

  toObject(): Promise<any> {
    return this.toJson().then((jsonString) => {
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
