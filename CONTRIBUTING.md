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

## Testing
Tests are written using Jest and run in a JSDOM environment:

- Add test cases in `<tool-name>/*.test.js` files
- Use the provided `testHelper.js` helper for test assertions
- Run all tests with `npm test`
- Ensure edge cases are covered
- Tests run in JSDOM environment for DOM manipulation
- Cross-browser testing still needed manually
- Run development server with `npm run dev` command

## Building
Production builds are created using `npm run build`:

- Creates minified versions of JS and CSS files
- Updates HTML to reference minified assets
- Copies static assets (images)
- Build output goes to `build/` directory

## Documentation
- Each tool directory must have a README.md with:
  - Description
  - Usage instructions
  - Example inputs/outputs
  - Any notable limitations
  - Screenshots
  - Security/Privacy considerations
- Keep documentation up-to-date with changes
- For the post-migration steady-state workflow (bundle metrics, QA, TS migration), follow [Phase H Contributor Workflow](/Users/mdaliahsanrana/Work/codesamplez/codesamplez-tools/docs/phase-h-contributor-workflow.md).
- For user-visible PR communication and shared-surface review expectations, follow [Phase H Release And Change Communication Workflow](/Users/mdaliahsanrana/Work/codesamplez/codesamplez-tools/docs/phase-h-release-communication-workflow.md).

## Development Workflow
1. Pull latest changes while on "main" branch (`git pull`)
2. Create a feature branch (`git checkout -b <branch-name>`)
3. Install dependencies (`npm install`)
4. Make your changes
5. Add/update tests
6. Run tests (`npm test`)
7. Build the project (`npm run build`)
8. Update documentation if needed
9. Create a pull request (`gh pr create --base main --head <branch-name>`)
10. Address any review feedback
