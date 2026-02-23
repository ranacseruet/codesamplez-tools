function createDebug() {
  const noop = function noop() {};
  noop.enabled = false;
  noop.extend = () => noop;
  return noop;
}

createDebug.default = createDebug;
createDebug.enable = () => {};
createDebug.disable = () => '';
createDebug.enabled = () => false;
createDebug.coerce = (value) => value;
createDebug.humanize = (value) => String(value);
createDebug.formatters = {};

module.exports = createDebug;
module.exports.default = createDebug;
