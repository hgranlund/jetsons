export type NextStackElement = {
  next: string | Buffer;
  elements: StackElementType[];
  done: boolean;
};

export type StackElementType = {
  next: (size: number) => NextStackElement | Promise<NextStackElement>;
};
