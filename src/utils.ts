/* eslint-disable no-misleading-character-class */
/* eslint-disable no-control-regex */
const rxEscapable = /[\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;

export const escapeString = (str: string): string =>
  str.replace(rxEscapable, (char) => {
    switch (char) {
      case '\b':
        return '\\b';
      case '\t':
        return '\\t';
      case '\n':
        return '\\n';
      case '\f':
        return '\\f';
      case '\r':
        return '\\r';
      case '"':
        return '\\"';
      case '\\':
        return '\\\\';
      default:
        return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
    }
  });

export const quote = (str: string): string => `"${escapeString(str)}"`;

const isFn = (fn: any): boolean => {
  return typeof fn === 'function';
};

const isRequest = (stream: any): boolean => {
  return stream.setHeader && typeof stream.destroy === 'function';
};

export const endStream = (stream: any): void => {
  if (isRequest(stream)) return stream.abort();
  if (isFn(stream.end)) return stream.end();
  if (isFn(stream.destroy)) return stream.destroy();
};
