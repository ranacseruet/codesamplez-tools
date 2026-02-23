function toSingleQuoted(jsonQuoted) {
  const inner = jsonQuoted.slice(1, -1);
  return `'${inner.replace(/'/g, "\\'")}'`;
}

function jsescLite(value, options = {}) {
  if (typeof value === 'string') {
    const jsonQuoted = JSON.stringify(value)
      // Keep these escaped for JS source safety in inline script contexts.
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');

    if (options.wrap === false) {
      return jsonQuoted.slice(1, -1);
    }

    if (options.quotes === 'single') {
      return toSingleQuoted(jsonQuoted);
    }

    return jsonQuoted;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }

  return JSON.stringify(value);
}

module.exports = jsescLite;
module.exports.default = jsescLite;
