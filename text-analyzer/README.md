# Text Analyzer

A lightweight, browser-based text analysis tool that provides real-time statistics about your text.

![Text Analyzer Tool](images/featured.png)

## Privacy & Security
- 🔒 **100% Client-Side Processing**: All text analysis happens locally in your browser
- 🚫 **No Data Storage**: Your text is never saved or transmitted to any server
- 💻 **Offline Support**: Works without internet connection after initial page load
- 🔐 **Zero Data Collection**: No cookies, tracking, or data persistence
- 🧹 **Session Privacy**: All text is cleared when you close the browser tab

## Features

- **Character Count**: Counts every character in the text, including spaces and punctuation
- **Word Count**: Calculates the number of words by splitting text on whitespace
- **Sentence Count**: Estimates the number of sentences by identifying common sentence endings (., !, ?)
- **Line Count**: Tracks the number of lines in the text based on line breaks
- **Paragraph Count**: Counts paragraphs by identifying text blocks separated by blank lines
- **Average Word Length**: Calculates the mean length of words (excluding punctuation)
- **Average Sentence Length**: Computes the average number of words per sentence
- **Reading Time**: Estimates how many minutes the text takes to read at 200 words per minute
- **Readability Scores**: Reports Flesch Reading Ease and Flesch-Kincaid grade level using a dependency-free syllable heuristic; displays `—` when the metric is not applicable
- **Keyword Density**: Shows the most frequent non-stop word and the percentage of total words it represents; numeric-only tokens are ignored
- **Punctuation Statistics**: Tracks usage frequency of common punctuation marks (periods, commas, question marks, exclamation marks)
- **File Input**: Click "Upload File" or drag a text file onto the input to analyze it; the file is read in the browser and never uploaded (5 MB limit, binary files rejected)

## Performance

- Text up to 5,000 characters is analyzed synchronously to avoid worker startup and round-trip overhead.
- Larger inputs offload the statistics computation to a Web Worker so typing remains responsive.
- If workers are unavailable or the worker chunk cannot load, analysis falls back automatically to the main thread.
- Only the statistics computation is offloaded; rendering the results remains in the browser UI on the main thread.

## Usage

### Online
1. Visit [tools.codesamplez.com/text-analyzer](https://tools.codesamplez.com/text-analyzer)
2. Enter or paste your text in the textarea, or click "Upload File" to choose a local text file
3. View real-time statistics updating automatically as you type or modify the text

### Local Development
1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Visit `http://localhost:8080` in your browser
5. Navigate to the Text Analyzer tool

## Development

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Run tests: `npm test`

### Testing
Tests are written using Jest:
- Run all tests: `npm test`
- Run text analyzer tests specifically: `npm test text-analyzer`
- View test coverage: `npm run test:coverage`

All test files are located in the same directory as their implementation files.

## How It Works

The tool uses vanilla JavaScript with event listeners to provide real-time text analysis:

- **Character Counting**: Direct string length measurement with support for Unicode characters
- **Word Counting**: Splits text on whitespace and filters empty entries
- **Sentence Detection**: Uses regex pattern `[.!?]+` to identify sentence boundaries, with special handling for abbreviations
- **Line Counting**: Splits text on newline characters (`\n`)
- **Paragraph Analysis**: Identifies text blocks separated by blank lines
- **Reading Time**: Divides the word count by 200 and rounds up to the next minute
- **Readability**: Applies the Flesch Reading Ease and Flesch-Kincaid formulas to the analyzer's sentence, word, and estimated syllable counts; scores are bounded for display and use `—` when no English word-based score is available
- **Keyword Density**: Divides the most frequent non-stop word's count by the total word count and expresses it as a percentage; numeric-only tokens are excluded from keyword candidates

## Architecture

The application follows a modular architecture:

- **HTML5**: Semantic markup for accessibility and SEO, using shared classes where applicable.
- **CSS**: Leverages shared styles from `common/shared-styles.css` for base elements, layout, and common components (buttons, notifications). Tool-specific styles or overrides are located in `text-analyzer/styles.css`. Follows BEM methodology.
- **JavaScript**: Vanilla JS with modular class-based design.

### Key Components

```javascript
// Real-time text analysis with modular update functions
document.addEventListener('DOMContentLoaded', () => {
    const textInput = document.querySelector('.text-analyzer-input');
    textInput.addEventListener('input', analyzeText);
});

function analyzeText() {
    const text = document.querySelector('.text-analyzer-input').value;
    
    // Update all statistics
    updateWordCount(text);
    updateCharCount(text);
    updateParagraphCount(text);
    updateAverageWordLength(text);
    updateAverageSentenceLength(text);
    updatePunctuationStats(text);
}

// Example of new analysis functions
function updateParagraphCount(text) {
    const paragraphs = text.trim().split(/\n\s*\n/).filter(para => para.length > 0);
    document.querySelector('#paragraphCount').textContent = paragraphs.length;
}

function updatePunctuationStats(text) {
    const stats = {
        periods: (text.match(/\./g) || []).length,
        commas: (text.match(/,/g) || []).length,
        questions: (text.match(/\?/g) || []).length,
        exclamations: (text.match(/!/g) || []).length
    };
    // Update UI with punctuation counts
}
```

## Limitations

- Word count is approximate and may not handle all international writing systems perfectly
- Sentence detection is basic and may not catch all edge cases (e.g., abbreviations with periods)
- Line count includes empty lines after trimming whitespace
- Readability scores use an English-oriented syllable heuristic and are estimates, especially for names, technical terms, and non-English text; `—` means no applicable English word-based score was available
- Keyword density reports the most frequent non-stop word rather than every possible keyword or phrase, and ignores numeric-only tokens

## Future Improvements

- **Export Capabilities**:
  - Export analysis results as CSV/PDF
  - Save text with statistics for later reference
  
- **UI Enhancements**:
  - Dark mode support
  - Customizable text area size
  - Multiple document comparison
  
- **Language Support**:
  - Multi-language support for word/sentence detection
  - Special character handling for different writing systems
