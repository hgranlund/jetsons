const rxEscapable = /[\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;

const escape = string =>
  string.replace(rxEscapable, char => {
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
        return `\\u${char
          .charCodeAt(0)
          .toString(16)
          .padStart(4, '0')}`;
    }
  });

const quote = string => `"${escape(string)}"`;

module.exports = { quote, escape };
