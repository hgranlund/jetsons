const rxEscapable = /[\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;

function escapeString(string) {
  // Modified code, original code by Douglas Crockford
  // Original: https://github.com/douglascrockford/JSON-js/blob/master/json2.js

  // If the string contains no control characters, no quote characters, and no
  // backslash characters, then we can safely slap some quotes around it.
  // Otherwise we must also replace the offending characters with safe escape
  // sequences.

  return string.replace(rxEscapable, a => {
    const c = meta[a];
    return typeof c === 'string'
      ? c
      : `\\u${a
          .charCodeAt(0)
          .toString(16)
          .padStart(4, '0')}`;
  });
}

function quoteString(string) {
  return `"${escapeString(string)}"`;
}
