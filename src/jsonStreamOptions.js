class JsonStreamOptions {
  constructor(replacer, space, depth = 0) {
    this.replacer = replacer;
    this._space = space;
    this.space = this.spaceFunction(space);
    this.debug = depth;
  }

  isReplacerAFunction() {
    return typeof this.replacer === 'function';
  }

  isReplacerAArray() {
    return Array.isArray(this.replacer);
  }

  initReplace(value) {
    if (typeof this.replacer === 'function') {
      return this.replacer('', value);
    } else {
      return value;
    }
  }

  spaceFunction(space) {
    if (Number.isInteger(space)) {
      const number = space > 10 ? 10 : space;
      return depth => `\n${' '.repeat(depth * number)}`;
    }
    if (typeof space === 'string' && space !== '') {
      const newSpace = space.substring(0, 10);
      return depth => `\n${newSpace.repeat(depth)}`;
    }
    return () => '';
  }
}
module.exports = JsonStreamOptions;
