# Text Analyzer

A lightweight, browser-based text analysis tool that provides real-time statistics about your text.

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
- **Punctuation Statistics**: Tracks usage frequency of common punctuation marks (periods, commas, question marks, exclamation marks)

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
- CSS for modular, namespaced styling
- Vanilla JavaScript for functionality

Key components:
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

## Future Improvements

- **Advanced Word Analysis**: 
  - Reading time estimation
  - Readability scoring (Flesch-Kincaid, etc.)
  - Keyword density analysis
  
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
