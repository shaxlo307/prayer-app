// Custom jest transform: strips Flow "const" type parameter syntax that
// @babel/parser cannot handle, then delegates to babel-jest.
const babelJest = require("babel-jest");
const transformer = babelJest.default || babelJest;
const underlying = transformer.createTransformer
  ? transformer.createTransformer()
  : transformer;

module.exports = {
  process(sourceText, sourcePath, options) {
    // Strip Flow's const modifier in generic type params: <const T: X> → <T: X>
    const patched = sourceText
      .replace(/<(\s*)const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, "<$1$2:")
      .replace(/,(\s*)const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, ",$1$2:");
    return underlying.process(patched, sourcePath, options);
  },
  getCacheKey(...args) {
    return underlying.getCacheKey
      ? underlying.getCacheKey(...args)
      : String(Date.now());
  },
};
