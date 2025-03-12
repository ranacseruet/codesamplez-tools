  
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
    // This is a simplified implementation that combines identical selectors
    // A more robust implementation would need to parse the CSS properly
    
    // Parse CSS into an object representation
    const cssObj = {};
    const blocks = css.match(/[^{]+{[^}]*}/g) || [];
    
    blocks.forEach(block => {
      const [selector, declarations] = block.split('{');
      const cleanSelector = selector.trim();
      const cleanDeclarations = declarations.replace('}', '').trim();
      
      if (cleanDeclarations.length === 0) {
        return; // Skip empty declaration blocks
      }
      
      if (!cssObj[cleanSelector]) {
        cssObj[cleanSelector] = new Set();
      }
      
      // Add all declarations to the set for this selector
      cleanDeclarations.split(';').forEach(decl => {
        const trimmed = decl.trim();
        if (trimmed) {
          cssObj[cleanSelector].add(trimmed);
        }
      });
    });
    
    // Convert back to CSS string
    let result = '';
    for (const selector in cssObj) {
      const declarations = Array.from(cssObj[selector]);
      if (declarations.length > 0) {
        result += `${selector}{${declarations.join(';')}}`;
      }
    }
    
    return result;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { removeCommentsFromCss, removeWhitespaceFromCss, shortenColorsInCss, removeUnnecessaryUnits, removeLastSemicolonsFromCss, combineSelectorsInCss };
  } 