![The Jetsons](https://github.com/hgranlund/jetsons/raw/master/jetsonsBalckAndWhilte.jpg)

#

[![GitHub stars](https://img.shields.io/github/stars/hgranlund/jetsons.svg?style=social&label=Stars)](https://github.com/hgranlund/jetsons)
[![Build](https://travis-ci.org/hgranlund/jetsons.png)](http://travis-ci.org/hgranlund/jetsons)
[![Coverage Status](https://coveralls.io/repos/github/hgranlund/jetsons/badge.svg?branch=master)](https://coveralls.io/github/hgranlund/jetsons?branch=master)

The Jetsons's is a family of Readable Streams that transforms objects onto a serialized output (e.g. JSON). It recursively resolves Promises or Readable streams. As of now, the Jetsons's is a very small family with only one Stream, JsonStream, but hopefully more is comming.

The JsonStream is a Readable stream that transforms objects into JSON in a JSON.stringify() fashion.

## Main Features

- Serialize values in a JSON.stringify fashion.
- Streams can be stringified as different JsonTypes (array, string, raw).
- Streams in object mode defaults to JsonType.array.
- Streams in non-object mode defaults to JsonType.string.
- Promises are rescursively resolved and emitted as JSON.
- Destroys all streams if one of them closes .
- Propagates stream-close and stream errors in a ([pump](https://www.npmjs.com/package/pump)-like) fashion. (Usefull e.g. on aborted requests).
- High performance.
- Great memory management.
- Handling backpressure.
- Supports JSON.stringify replacer parameter.
- Supports JSON.stringify space parameter.

## Install

```bash
npm install jetsons --save
```

## Usage

```javascript
const { JsonStream } = require('jetsons');

const jsonStream = new JsonStream({
  aPromise: Promise.resolve('A resolved text'),
  aStringStream: ReadableStream('A streamed value'),
  array: [1, '2'],
});

jsonStream.pipe(process.stdout);
// {
//   "aPromise": "A resolved text",
//   "aStringStream": "A streamed value",
//   "array": [1, "2"]
// }
```

### Streams with different **_jsonType`s_**

```javascript
const { JsonStream } = require('jetsons');

const arrayStream = Readable.from(fibonacciGenerator(1, 9)):
arrayStream.jsonType = JsonStream.jsonTypes.array;

const rawStream = Readable.from(fibonacciStringGenerator(1, 9)):
rawStream.jsonType = JsonStream.jsonTypes.raw;

const stringStream = Readable.from(fibonacciGenerator(1, 9)):
stringStream.jsonType = JsonStream.jsonTypes.string;

const jsonStream = new JsonStream({
  arrayStream,
  rawStream,
  stringStream
});

jsonStream.pipe(process.stdout);
// {
//   "arrayStream": [1, 1, 2, 3, 5, 8, 13, 21],
//   "rawStream": 1123581321,
//   "stringStream": "1123581321"
// }
```

### Practical example with Express

```javascript
const { JsonStream } = require('jetsons');

app.get('/resource', (req, res, next) => {
  const jsonStream = new JsonStream({
    aValue: 'We define',
    aExternalHttpRequest: request.get('https://quotes.rest/qod'),
  })
  jsonStream.pipe(res),
  }
);
```

## API spesification

### JsonStream

```
new JsonStream(value[, replacer[, space]])
```

#### Parameters

- `value:` The value to convert to a JSON string.

- `replacer (Optional):`
  A function that alters the behavior of the stringification process, or an array of String and Number objects that serve as a whitelist for selecting/filtering the properties of the value object to be included in the JSON string. If this value is null or not provided, all properties of the object are included in the resulting JSON string.
- `space (Optional):`
  A String or Number object that's used to insert white space into the output JSON string for readability purposes.

  If this is a Number, it indicates the number of space characters to use as white space; this number is capped at 10 (if it is greater, the value is just 10). Values less than 1 indicate that no space should be used.

  If this is a String, the string (or the first 10 characters of the string, if it's longer than that) is used as white space. If this parameter is not provided (or is null), no white space is used.

#### Return value

A Readable stream that outputs a JSON string representing the given value.

#### Exceptions

Throws a TypeError ("BigInt value can't be serialized in JSON") when trying to stringify a BigInt value.

Throws a Error ("Readable Stream has already ended. Unable to process it") when trying to process a stream that has allready ended.

Throws a Error ("Readable Stream is in flowing mode, data may be lost") when trying to process a stream that is in a flowing state.

<!-- // TODO: Throws a TypeError ("cyclic object value") exception when a circular reference is found. -->

### Description

**_JsonStream_** is a Readable stream that outputs the JSON representing **_value_**.

- If a Readable stream has **_objectMode = true_**, each chunck/object til be stringified as a normal **_value_**.

- If a Readable stream has **_objectMode = false_**, it will be stringified as a string.

- If a Readable stream has a **_jsonType_** property, the resulting stream output with be stringified as that type. Available values are: **_raw_**, **_string_**, **_object_** and **_array_**. the values are available on **_JsonStream.jsonTypes_**.

- If the **_value_** has a **_toJSON_** method, it's responsible to define what data will be serialized.

- **Boolean**, **_Number_**, and **String** objects are converted to the corresponding primitive values during stringification, in accord with the traditional conversion semantics.

- If **_undefined_**, a **_Function_**, or a **_Symbol_** is encountered during conversion it is either omitted (when it is found in an **_object_**) or censored to null (when it is found in an array).

- **_JsonStream_** can also just return **_undefined_** when passing in "pure" values like JsonStream(function(){}) or JsonStream(undefined).

- All **_Symbol_**-keyed properties will be completely ignored, even when using the replacer **_function_**.

- The instances of **_Date_** implement the toJSON() function by returning a string (the same as date.toISOString()). Thus, they are treated as strings.

- The numbers **_Infinity_** and **_NaN_**, as well as the value **_null_**, are all considered **_null_**.

- All the other Object instances (including **_Map_**, **_Set_**, **_WeakMap_**, and **_WeakSet_**) will have only their enumerable properties serialized.

#### The replacer parameter

The **_replacer_** parameter can be either a function or an array.

As a function, it takes two parameters: the key and the value being stringified. The object in which the key was found is provided as the replacer's this parameter.

Initially, the **_replacer_** function is called with an empty string as key representing the object being stringified. It is then called for each property on the object or array being stringified.

It should return the value that should be added to the JSON string, as follows:

- If you return a **_Number_**, the string corresponding to that number is used as the value for the property when added to the JSON string.
- If you return a **_String_**, that string is used as the property's value when adding it to the JSON string.
- If you return a **_Boolean_**, "true" or "false" is used as the property's value, as appropriate, when adding it to the JSON string.
- If you return **_null_**, null will be added to the JSON string.
- If you return any other **_object_**, the object is recursively stringified into the JSON string, calling the replacer function on each property, unless the object is a function, in which case nothing is added to the JSON string.
- If you return **_undefined_**, the property is not included (i.e., filtered out) in the output JSON string

#### The space argument

The space argument may be used to control spacing in the final string.

- If it is a number, successive levels in the stringification will each be indented by this many space characters (up to 10).
- If it is a string, successive levels will be indented by this string (or the first ten characters of it).

## Development

### Test

Run tests by:

```bash
npm test
```

Run performance tests by:

```bash
npm run perf
```

### Debug

Jetsons uses [debug](https://www.npmjs.com/package/debug). To enable debug logging set environment variable:

```bash
DEBUG='jetsons:*'
```

## Support

Submit an [issue](https://github.com/hgranlund/jetsons/issues/new)

## Contribute

[Contribute](https://github.com/hgranlund/jetsons/blob/master/CONTRIBUTING.md) usage docs

## License

[MIT License](https://github.com/hgranlund/jetsons/blob/master/LICENSE)

[Simen Haugerud Granlund](https://hgranlund.com) © 2019

## Credits

- [Simen Haugerud Granlund](https://hgranlund.com) - Author
