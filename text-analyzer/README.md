# Text Analyzer

A lightweight, browser-based text analysis tool that provides real-time statistics about your text.

## Features

- **Character Count**: Counts every character in the text, including spaces and punctuation
- **Word Count**: Calculates the number of words by splitting text on whitespace
- **Sentence Count**: Estimates the number of sentences by identifying common sentence endings (., !, ?)
- **Line Count**: Tracks the number of lines in the text based on line breaks

## Usage

1. Open `index.html` in your web browser
2. Enter or paste your text in the textarea
3. View real-time statistics updating automatically as you type or modify the text

## How It Works

The tool uses vanilla JavaScript with event listeners to provide real-time text analysis:

- **Character Counting**: Direct string length measurement
- **Word Counting**: Splits text on whitespace and filters empty entries
- **Sentence Detection**: Uses regex pattern `[.!?]+` to identify sentence boundaries
- **Line Counting**: Splits text on newline characters (`\n`)

## Technical Implementation

The application is built using:
- HTML5 for structure
- CSS for styling
- Vanilla JavaScript for functionality

Key components:
```javascript
// Real-time updating through input event listener
textInput.addEventListener('input', () => {
    const text = textInput.value;
    
    // Character count
    charCount.textContent = text.length;

    // Word count
    const words = text.trim().split(/\s+/);
    wordCount.textContent = words.length === 1 && words[0] === "" ? 0 : words.length;

    // Sentence count
    const sentences = text.trim().split(/[.!?]+/);
    sentenceCount.textContent = sentences.length === 1 && sentences[0] === "" ? 0 : sentences.length;

    // Line count
    const lines = text.trim().split('\n');
    lineCount.textContent = lines.length;
});
```

## Limitations

- Word count is approximate and may not handle all international writing systems perfectly
- Sentence detection is basic and may not catch all edge cases (e.g., abbreviations with periods)
- Line count includes empty lines after trimming whitespace

## Future Improvements

- **Advanced Word Analysis**: 
  - Reading time estimation
  - Readability scoring (Flesch-Kincaid, etc.)
  - Keyword density analysis
  
- **Enhanced Text Statistics**:
  - Paragraph count
  - Average sentence/word length
  - Punctuation usage statistics
  
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
