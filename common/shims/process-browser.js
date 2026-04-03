const processShim = {
  env: {
    NODE_ENV: 'production',
    BABEL_TYPES_8_BREAKING: false
  },
  platform: 'browser'
};

module.exports = processShim;
module.exports.default = processShim;
