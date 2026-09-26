  
  // Helper Functions for CSS Minification
  function maskCssTokens(
    css: string,
    protectComments = true
  ): { maskedCss: string; restore: (transformedCss: string) => string } {
    let placeholderPrefix = '__CSS_MINIFIER_TOKEN_';
    while (css.indexOf(placeholderPrefix) !== -1) {
      placeholderPrefix = '_' + placeholderPrefix;
    }
    const placeholderPattern = new RegExp(`${placeholderPrefix}(\\d+)__`, 'g');

    const tokens: string[] = [];
    let maskedCss = '';
    const maskToken = (token: string) => {
      maskedCss += placeholderPrefix + tokens.length + '__';
      tokens.push(token);
    };

    let index = 0;
    while (index < css.length) {
      const char = css[index];
      if (char === '\\' && index + 1 < css.length) {
        maskedCss += css.slice(index, index + 2);
        index += 2;
        continue;
      }

      if (char === '"' || char === "'") {
        const start = index;
        index += 1;
        while (index < css.length) {
          if (css[index] === '\\') {
            index += 2;
          } else if (css[index] === char) {
            index += 1;
            break;
          } else {
            index += 1;
          }
        }
        maskToken(css.slice(start, index));
        continue;
      }

      if (char === '/' && css[index + 1] === '*') {
        const commentEnd = css.indexOf('*/', index + 2);
        const nextIndex = commentEnd === -1 ? css.length : commentEnd + 2;
        const comment = css.slice(index, nextIndex);
        if (protectComments) {
          maskToken(comment);
        } else {
          maskedCss += comment;
        }
        index = nextIndex;
        continue;
      }

      maskedCss += char;
      index += 1;
    }

    return {
      maskedCss,
      restore(transformedCss: string) {
        return transformedCss.replace(placeholderPattern, (placeholder, tokenIndex: string) => {
          return tokens[Number(tokenIndex)] ?? placeholder;
        });
      }
    };
  }

  function removeCommentsFromCss(css) {
    // Remove both single-line and multi-line comments
    const tokenized = maskCssTokens(css, false);
    return tokenized.restore(tokenized.maskedCss.replace(/\/\*[\s\S]*?\*\//g, ''));
  }
  
  function removeWhitespaceFromCss(css) {
    const tokenized = maskCssTokens(css);
    let minified = tokenized.maskedCss;

    // Mask math functions (calc/min/max/clamp) first: their `+` and `-`
    // operators must stay surrounded by whitespace (CSS Values and Units
    // §8.1.1 — `calc(100%+20px)` is invalid and the declaration is dropped
    // by browsers). Placeholder survives the operator/paren passes below.
    let mathPlaceholderPrefix = '__CSS_MINIFIER_MATH_';
    while (css.indexOf(mathPlaceholderPrefix) !== -1) {
      mathPlaceholderPrefix = '_' + mathPlaceholderPrefix;
    }
    const mathTokens = [];
    const mathFnPattern = /(calc|clamp|min|max)\(/gi;
    let mathMasked = '';
    let scanIndex = 0;
    let fnMatch;
    while ((fnMatch = mathFnPattern.exec(minified))) {
      const fnStart = fnMatch.index;
      // Skip matches that are the tail of a longer identifier (e.g. `admin(`);
      // a leading `-` (as in `-webkit-calc(`) is fine.
      const prevChar = fnStart > 0 ? minified[fnStart - 1] : '';
      if (/[\w]/.test(prevChar)) {
        continue;
      }
      let depth = 0;
      let fnEnd = fnStart;
      for (; fnEnd < minified.length; fnEnd += 1) {
        if (minified[fnEnd] === '(') depth += 1;
        else if (minified[fnEnd] === ')') {
          depth -= 1;
          if (depth === 0) {
            fnEnd += 1;
            break;
          }
        }
      }
      mathMasked += minified.slice(scanIndex, fnStart) + mathPlaceholderPrefix + mathTokens.length + '__';
      mathTokens.push(minified.slice(fnStart, fnEnd));
      scanIndex = fnEnd;
      mathFnPattern.lastIndex = fnEnd;
    }
    mathMasked += minified.slice(scanIndex);
    minified = mathMasked;

    // Remove line breaks and extra spaces
    minified = minified.replace(/[\r\n\t]+/g, ' ');

    // Remove spaces around selectors
    minified = minified.replace(/\s*([{}:;,])\s*/g, '$1');

    // Remove spaces after commas in selectors
    minified = minified.replace(/,\s+/g, ',');

    // Remove spaces around operators in media queries
    minified = minified.replace(/\s*([>~+])\s*/g, '$1');

    // Remove spaces inside parentheses
    minified = minified.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');

    // Remove leading and trailing spaces
    minified = minified.trim();

    // Collapse multiple spaces into one
    minified = minified.replace(/\s+/g, ' ');

    // Remove spaces between closing bracket and opening bracket
    minified = minified.replace(/}\s+{/g, '}{');

    // Remove space before !important
    minified = minified.replace(/\s+!important/g, '!important');

    // Restore math functions now that operator stripping is done.
    minified = minified.replace(
      new RegExp(`${mathPlaceholderPrefix}(\\d+)__`, 'g'),
      (placeholder, tokenIndex) => mathTokens[Number(tokenIndex)] ?? placeholder
    );

    return tokenized.restore(minified);
  }

  // Pre-compiled regex for hex color shortening
  const hexColorRegex = /#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3/gi;

  // Pre-compiled map and regex for named color shortening.
  // `green` is deliberately absent: the CSS keyword is #008000 (dark green),
  // not #0f0/#00ff00 (that is `lime`), so replacing it would mutate the
  // rendered color — and keeping the keyword is already byte-shortest.
  const colorMap = {
    'white': '#fff',
    'black': '#000',
    'red': '#f00',
    'blue': '#00f',
    'yellow': '#ff0',
    'cyan': '#0ff',
    'magenta': '#f0f'
  };

  const colorPattern = Object.keys(colorMap).join('|');
  const colorRegex = new RegExp(`(:|\\s)(${colorPattern})(?=(;|\\s|\\}|$))`, 'gi');
  
  function shortenColorsInCss(css) {
    const tokenized = maskCssTokens(css);
    let minified = tokenized.maskedCss;
    
    // Replace #RRGGBB with #RGB when possible
    minified = minified.replace(hexColorRegex, '#$1$2$3');
    
    // Replace named colors with hex values if shorter
    minified = minified.replace(colorRegex, (match, prefix, color) => {
      return `${prefix}${colorMap[color.toLowerCase()]}`;
    });
    
    return tokenized.restore(minified);
  }
  
  function removeUnnecessaryUnits(css) {
    // Remove units from zero values (0px, 0em, etc)
    const tokenized = maskCssTokens(css);
    return tokenized.restore(
      tokenized.maskedCss.replace(/(\s|:)0(px|em|rem|pt|pc|vh|vw|vmin|vmax|ex|ch|mm|cm|in|%)/g, '$10')
    );
  }
  
  function removeLastSemicolonsFromCss(css) {
    // Remove last semicolon in each declaration block
    const tokenized = maskCssTokens(css);
    return tokenized.restore(tokenized.maskedCss.replace(/;}/g, '}'));
  }
  
  function combineSelectorsInCss(css) {
    const tokenized = maskCssTokens(css);
    const protectedCss = tokenized.maskedCss;

    // Helper function to clean declarations
    function cleanDeclarations(declarations) {
      return declarations
        .split(';')
        .map(d => d.trim())
        .filter(d => d.length > 0)
        .join(';');
    }

    // Process single CSS rule
    function processCssRule(selector, declarations) {
      selector = selector.trim();
      declarations = cleanDeclarations(declarations.replace(/\}/g, '').trim());
      return declarations ? `${selector}{${declarations};}` : '';
    }

    // Walk a rule sequence (the top level or the body of an at-rule block) in
    // document order, formatting style rules and recursing into nested at-rule
    // blocks. Order matters: hoisting all @media blocks above base rules
    // inverts the cascade for equal-specificity declarations. Any at-rule
    // block with a brace-delimited body (@media, @supports, @keyframes,
    // @layer, @container, @font-face, ...) is handled here; statement at-rules
    // (@import, @charset, @namespace) pass through verbatim so they are not
    // silently dropped the way flat rule regexes used to lose them.
    function processRuleSequence(css) {
      let result = '';
      let index = 0;

      while (index < css.length) {
        const char = css[index];
        if (/\s/.test(char)) {
          index += 1;
          continue;
        }

        if (char === '@') {
          const remaining = css.slice(index);
          const braceIndex = remaining.indexOf('{');
          const semiIndex = remaining.indexOf(';');

          if (braceIndex !== -1 && (semiIndex === -1 || braceIndex < semiIndex)) {
            // Block at-rule: find its balanced close brace and recurse.
            let depth = 0;
            let closeIndex = -1;
            for (let i = braceIndex; i < remaining.length; i += 1) {
              if (remaining[i] === '{') depth += 1;
              else if (remaining[i] === '}') {
                depth -= 1;
                if (depth === 0) {
                  closeIndex = i;
                  break;
                }
              }
            }
            const bodyEnd = closeIndex === -1 ? remaining.length : closeIndex;
            const header = remaining.slice(0, braceIndex);
            const body = remaining.slice(braceIndex + 1, bodyEnd);
            const processedBody = processRuleSequence(body);
            result += processedBody ? `${header}{${processedBody}}` : `${header}{}`;
            index += closeIndex === -1 ? remaining.length : closeIndex + 1;
            continue;
          }

          if (semiIndex !== -1) {
            // Statement at-rule: keep as-is, including its trailing semicolon.
            result += remaining.slice(0, semiIndex + 1);
            index += semiIndex + 1;
            continue;
          }

          // Malformed at-rule: leave the tail untouched (pure transform).
          result += remaining;
          break;
        }

        // Style rule: selector up to '{', declarations up to the first '}'.
        const braceIndex = css.indexOf('{', index);
        if (braceIndex === -1) {
          result += css.slice(index);
          break;
        }
        const closeIndex = css.indexOf('}', braceIndex);
        const ruleEnd = closeIndex === -1 ? css.length : closeIndex + 1;
        const [selector, declarations] = css.slice(index, ruleEnd).split('{');
        result += processCssRule(selector, declarations);
        index += ruleEnd;
      }

      return result;
    }

    const processed = processRuleSequence(protectedCss);
    return tokenized.restore(processed);
  }

export interface CssMinifyOptions {
  removeComments: boolean;
  removeWhitespace: boolean;
  combineSelectors: boolean;
  shortenColors: boolean;
  removeUnits: boolean;
  removeLastSemicolons: boolean;
}

const DEFAULT_MINIFY_OPTIONS: Readonly<CssMinifyOptions> = {
  removeComments: true,
  removeWhitespace: true,
  combineSelectors: true,
  shortenColors: true,
  removeUnits: true,
  removeLastSemicolons: true
};

// The single minification pipeline the UI runs. Step order matters: selectors
// are combined before whitespace is stripped, and the trailing-semicolon pass
// runs last so it sees the final `;}` boundaries. Validation is the caller's
// job (see isValidCSS) so this stays a pure string transform.
function minifyCSS(css: string, options: CssMinifyOptions = DEFAULT_MINIFY_OPTIONS): string {
  let result = css;

  if (options.removeComments) {
    result = removeCommentsFromCss(result);
  }
  if (options.combineSelectors) {
    result = combineSelectorsInCss(result);
  }
  if (options.shortenColors) {
    result = shortenColorsInCss(result);
  }
  if (options.removeUnits) {
    result = removeUnnecessaryUnits(result);
  }
  if (options.removeWhitespace) {
    result = removeWhitespaceFromCss(result);
  }
  if (options.removeLastSemicolons) {
    result = removeLastSemicolonsFromCss(result);
  }

  return result;
}

// Parse CSS into its top-level rules without leaving a trace in the page.
// Constructable stylesheets parse detached from the document, so validation
// does not append/remove a <style> in the live <head> on every run. Engines
// without replaceSync (and jsdom) fall back to a transient <style> element;
// so does input containing @import, which replaceSync silently drops and
// would otherwise misreport as "no rules parsed".
function parseCssRules(cssString: string): CSSRule[] | null {
  if (
    typeof CSSStyleSheet === 'function'
    && typeof CSSStyleSheet.prototype.replaceSync === 'function'
    && !/@import\b/i.test(cssString)
  ) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(cssString);
    return Array.from(sheet.cssRules);
  }

  const styleElement = document.createElement('style');
  if (document.head) {
    document.head.appendChild(styleElement);
  }
  try {
    styleElement.textContent = cssString;
    const sheet = styleElement.sheet;
    return sheet && sheet.cssRules ? Array.from(sheet.cssRules) : null;
  } finally {
    if (styleElement.parentNode) {
      styleElement.parentNode.removeChild(styleElement);
    }
  }
}

function isValidCSS(cssString) {
  const trimmedCss = cssString.trim();
  if (!trimmedCss) {
    return true; // Empty CSS is considered valid
  }

  // Heuristic: Remove comments to see if there's any actual CSS content
  const cssWithoutComments = trimmedCss.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim();
  if (!cssWithoutComments) {
    return true; // CSS with only comments is considered valid
  }

  let rules: CSSRule[] | null;
  try {
    rules = parseCssRules(cssString);
  } catch (e) {
    // Errors during parsing mean invalid CSS
    return false;
  }

  if (!rules) {
    // If sheet or cssRules is null/undefined, it's invalid
    return false;
  }

  if (rules.length > 0) {
    // Check for invalid rules like "body { color: }" which might still create a rule
    const styleRule = rules[0] as CSSStyleRule;
    // Heuristic: if a rule exists, has a colon, but no actual styles applied, and doesn't look like a valid empty rule.
    // This targets "property: }"
    return !(styleRule.style && styleRule.style.length === 0 && cssWithoutComments.includes(':') && !cssWithoutComments.endsWith(';}') && cssWithoutComments.endsWith('}'));
  }

  // No rules parsed: valid only for an empty block like "selector {}". Content
  // beyond that (malformed comments, other syntax errors) is invalid.
  const contentAfterBraces = cssWithoutComments.replace(/[\w\s-]*\{[\s]*\}/g, '').trim();
  return contentAfterBraces === '';
}

export { removeCommentsFromCss, removeWhitespaceFromCss, shortenColorsInCss, removeUnnecessaryUnits, removeLastSemicolonsFromCss, combineSelectorsInCss, minifyCSS, isValidCSS, DEFAULT_MINIFY_OPTIONS };
