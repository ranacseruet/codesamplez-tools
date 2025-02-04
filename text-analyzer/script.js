const textInput = document.getElementById('text-input');
const charCount = document.getElementById('char-count');
const wordCount = document.getElementById('word-count');
const sentenceCount = document.getElementById('sentence-count');
const lineCount = document.getElementById('line-count');

textInput.addEventListener('input', () => {
    const text = textInput.value;

    // Character count
    charCount.textContent = text.length;

    // Word count (approximate)
    const words = text.trim().split(/\s+/);
    wordCount.textContent = words.length === 1 && words[0] === "" ? 0 : words.length;

    // Sentence count (approximate)
    const sentences = text.trim().split(/[.!?]+/);
    sentenceCount.textContent = sentences.length === 1 && sentences[0] === "" ? 0 : sentences.length;

    // Line count
    const lines = text.trim().split('\n');
    lineCount.textContent = lines.length === 1 && lines[0] === "" ? 0 : lines.length;
});
