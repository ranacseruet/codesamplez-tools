class TraceMap {
  constructor(inputMap) {
    this.inputMap = inputMap;
    this.resolvedSources = [];
    this.sourcesContent = [];
  }
}

function originalPositionFor() {
  return { name: null, source: null, line: null, column: null };
}

module.exports = {
  TraceMap,
  originalPositionFor
};
