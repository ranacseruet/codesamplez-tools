class GenMapping {
  constructor(options = {}) {
    this.options = options;
  }
}

function setSourceContent() {}
function maybeAddMapping() {}
function allMappings() {
  return [];
}
function toEncodedMap() {
  return { version: 3, sources: [], names: [], mappings: '' };
}
function toDecodedMap() {
  return { version: 3, sources: [], names: [], mappings: [] };
}

module.exports = {
  GenMapping,
  setSourceContent,
  maybeAddMapping,
  allMappings,
  toEncodedMap,
  toDecodedMap
};
