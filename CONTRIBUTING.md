# Contributing Guidelines

## Project Structure
The project consists of individual tools, each in their own directory:
- `tool-name/`
  - `index.html` - Main HTML file
  - `script.js` - JavaScript logic
  - `styles.css` - Styling
  - `README.md` - Tool documentation
  - `images/` - Tool screenshots/assets

## Adding New Tools
1. Create a new directory with the tool name
2. Include the standard files:
   - index.html
   - script.js
   - styles.css
   - README.md
   - images/ (if needed)
3. Follow existing patterns for code organization
4. Add your tool's HTML implementation to the main index.html with a unique meanifugl identifier for the container div. 
5. Avoid adding any external libraries/framework as much as possible.
    - Implementation should be in plain HTML, CSS and Javacript.
    - If need external dependency for some reason, ask/get approval before implementing.

## Code Style
- Use consistent indentation (2 spaces)
- Follow JavaScript ES6+ standards
    - Javascripts should be cross-browser compatible.
    - Seperate out different concernts/aspects of the logic.
- Use semantic HTML5 elements
- Keep CSS organized with BEM methodology
    - Avoid generic element identifier for style definitions(e.g 'body', 'h1' etc)
    - Define style definitions to be applicable to the main container class/id and elements under it.
    - Style definitions should be embeddeble in other web pages without affecting anything outside the tool container.
- Comment complex logic
- Keep files modular and focused

## Testing / Writing Unit Tests
Currently the tests are a bit un-usual than traditional. Tests are not run from node/npm cli command, instead are imported into the webpage itself. This is to keep this project entirely free of any tooling setup need etc.

- Include test cases in a `tests.js`(one per tool/subdirectory)
- Use the provided top level `testHelper.js` for assertions
- tests will be run on webpage, so avoid any node/npm type dependency. 
    - Reference it directly from the webpage with `<script>` tag.
    - Load the webpage on the browsers, test results should appear with pass/fail status.
- Ensure all edge cases are covered
- Test in multiple browsers

## Documentation
- Each tool must have a README.md with:
  - Description
  - Usage instructions
  - Example inputs/outputs
  - Screenshots
- Keep documentation up-to-date with changes

## Contribution Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add/update tests
5. Update documentation
6. Submit a pull request
7. Address any review feedback

## Code Review
- All contributions require review
- Reviewers will check for:
  - Code quality
  - Test coverage
  - Documentation
  - Style consistency
  - Browser compatibility
