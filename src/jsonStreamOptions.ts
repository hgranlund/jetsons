export type ReplacerFn = (key: string, value: any) => any;
export type ReplaceArray = (number | string)[];

export type Replacer = ReplacerFn | ReplaceArray;

export type SpaceReplacement = string | number;

type SpaceFn = ((depth: any) => string) | (() => string);

export class JsonStreamOptions {
  replacer: Replacer;
  spaceFn: SpaceFn;
  debug: number;
  constructor(replacer: Replacer, space: SpaceReplacement, depth = 0) {
    this.replacer = replacer;
    this.spaceFn = this.spaceFunction(space);
    this.debug = depth;
  }

  initReplace(value: any): any {
    if (typeof this.replacer === 'function') {
      return this.replacer('', value);
    } else {
      return value;
    }
  }

  spaceFunction(space: SpaceReplacement): SpaceFn {
    if (Number.isInteger(space) && typeof space === 'number') {
      const spaceCounts = space > 10 ? 10 : space;
      return (depth: number) => `\n${' '.repeat(depth * spaceCounts)}`;
    }
    if (typeof space === 'string' && space !== '') {
      const newSpace = space.substring(0, 10);
      return (depth: number) => `\n${newSpace.repeat(depth)}`;
    }
    return () => '';
  }
}
