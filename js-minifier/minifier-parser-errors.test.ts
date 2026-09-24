import { jest } from '@jest/globals';

const parserFailure = new Error('Unexpected parser failure');

jest.unstable_mockModule('@babel/parser', () => ({
  parse: jest.fn(() => {
    throw parserFailure;
  })
}));

describe('JSMinifier parser failures', () => {
  let JSMinifier: typeof import('./minifier').JSMinifier;

  beforeAll(async () => {
    ({ JSMinifier } = await import('./minifier'));
  });

  test('getSyntaxError rethrows unexpected parser failures', () => {
    expect(() => new JSMinifier().getSyntaxError('const x = 1;')).toThrow(parserFailure);
  });

  test('minify rethrows unexpected parser failures', () => {
    expect(() => new JSMinifier().minify('const x = 1;')).toThrow(parserFailure);
  });

  test('shortenVariableNames rethrows unexpected parser failures', () => {
    const minifier = new JSMinifier({ shortenVariables: true });

    expect(() => minifier.shortenVariableNames('const x = 1;')).toThrow(parserFailure);
  });

  test('mangleObjectProperties rethrows unexpected parser failures', () => {
    const minifier = new JSMinifier({ mangleProperties: true });

    expect(() => minifier.mangleObjectProperties('const x = 1;')).toThrow(parserFailure);
  });
});
