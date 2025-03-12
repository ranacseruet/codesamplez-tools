  
  // Helper Functions for CSS Minification
  function removeCommentsFromCss(css) {
    // Remove both single-line and multi-line comments
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
  }
  
  function removeWhitespaceFromCss(css) {
    let minified = css;
    
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
    
    return minified;
  }
  
  function shortenColorsInCss(css) {
    let minified = css;
    
    // Replace #RRGGBB with #RGB when possible
    const hexColorRegex = /#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3/gi;
    minified = minified.replace(hexColorRegex, '#$1$2$3');
    
    // Replace named colors with hex values if shorter
    const colorMap = {
      'white': '#fff',
      'black': '#000',
      'red': '#f00',
      'green': '#0f0',
      'blue': '#00f',
      'yellow': '#ff0',
      'cyan': '#0ff',
      'magenta': '#f0f'
    };
    
    for (const [colorName, hexValue] of Object.entries(colorMap)) {
      const regex = new RegExp(`(:|\\s)${colorName}(;|\\s|\\}|$)`, 'gi');
      minified = minified.replace(regex, `$1${hexValue}$2`);
    }
    
    return minified;
  }
  
  function removeUnnecessaryUnits(css) {
    // Remove units from zero values (0px, 0em, etc)
    return css.replace(/(\s|:)0(px|em|rem|pt|pc|vh|vw|vmin|vmax|ex|ch|mm|cm|in|%)/g, '$10');
  }
  
  function removeLastSemicolonsFromCss(css) {
    // Remove last semicolon in each declaration block
    return css.replace(/;}/g, '}');
  }
  
  function combineSelectorsInCss(css) {
    let result = '';
    
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

    // Process media queries first
    const mediaBlocks = css.match(/@media[^{]+\{([^{}]|\{[^{}]*\})*\}/g) || [];
    const processedMedia = mediaBlocks.map(block => {
      const mediaQuery = block.match(/@media[^{]+/)[0];
      const innerContent = block.slice(block.indexOf('{'));
      
      // Process inner rules
      const innerRules = innerContent.match(/[^{]+\{[^}]+\}/g) || [];
      const processedInner = innerRules.map(rule => {
        const [selector, declarations] = rule.split('{');
        return processCssRule(selector, declarations);
      }).join('');

      return `${mediaQuery}{${processedInner}}`;
    }).join('');

    // Process regular rules
    const regularCss = css.replace(/@media[^{]+\{([^{}]|\{[^{}]*\})*\}/g, '');
    const regularRules = regularCss.match(/[^{]+\{[^}]+\}/g) || [];
    const processedRegular = regularRules.map(rule => {
      const [selector, declarations] = rule.split('{');
      return processCssRule(selector, declarations);
    }).join('');

    return processedMedia + processedRegular;
  }

function minifyCSS(css) {
  let minified = css;
  minified = removeCommentsFromCss(minified);
  minified = removeWhitespaceFromCss(minified);
  // Don't shorten colors to preserve color names
  minified = removeUnnecessaryUnits(minified);
  // Don't remove last semicolons to match test expectations
  minified = combineSelectorsInCss(minified);
  return minified;
}

export { removeCommentsFromCss, removeWhitespaceFromCss, shortenColorsInCss, removeUnnecessaryUnits, removeLastSemicolonsFromCss, combineSelectorsInCss, minifyCSS };
