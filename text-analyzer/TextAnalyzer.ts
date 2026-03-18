const STOP_WORDS = new Set(
    'a an the and or but in on at to for of with by from as is are was were be been being have has had do does did will would could should may might must can shall this that these those i me my myself we our ours you your yours he him his she her hers it its they them their theirs up down out about into through during before after above below between among under over again further then once here there when where why how all any both each few more most other some such no nor not only own same so than too very s t just don now d ll m o re ve y ain aren couldn didn doesn hadn hasn haven isn ma mightn mustn needn shan shouldn wasn weren won wouldn'.split(' ')
);

type WordFrequencyEntry = {
    word: string;
    count: number;
};

export type TextAnalysisResult = {
    charCount: number;
    wordCount: number;
    lineCount: number;
    sentenceCount: number;
    paragraphCount: number;
    avgWordLength: string;
    avgSentenceLength: string;
    periodCount: number;
    commaCount: number;
    questionCount: number;
    exclamationCount: number;
    wordFrequency?: WordFrequencyEntry[];
};

export function analyzeText(text = ''): TextAnalysisResult {
    // Convert null/undefined to empty string and ensure we're working with a string
    text = String(text);

    // Handle empty input
    if (!text) {
        return {
            charCount: 0,
            wordCount: 0,
            lineCount: 0,
            sentenceCount: 0,
            paragraphCount: 0,
            avgWordLength: '0.00',
            avgSentenceLength: '0.00',
            periodCount: 0,
            commaCount: 0,
            questionCount: 0,
            exclamationCount: 0
        };
    }

    // Character count is straightforward
    const charCount = text.length;

    // Word count: split on whitespace and filter out empty strings
    const words = text.trim() ? text.trim().split(/\s+/) : [];
    const wordCount = words.length;

    // Average Word Length: calculate after stripping punctuation
    const totalWordLength = words.reduce((sum, word) => sum + word.replace(/[^a-zA-Z0-9]/g, '').length, 0);
    const avgWordLength = wordCount > 0 ? (totalWordLength / wordCount).toFixed(2) : '0.00';

    // Line count: split on newlines, but return 0 for empty string
    const lineCount = text ? text.split('\n').length : 0;

    // Sentence count
    let sentenceCount = 0;
    const trimmedText = text.trim();
    if (trimmedText) {
        // Match sentences ending with . ! ? followed by whitespace or end of string
        const sentences = trimmedText.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [];
        sentenceCount = sentences.length;
        // If there's remaining text without punctuation, count it as a sentence
        const remainingText = trimmedText.replace(/[^.!?]+[.!?]+(?:\s+|$)/g, '').trim();
        if (remainingText) {
            sentenceCount++;
        }
    }

    // Paragraph count
    let paragraphCount = 0;
    if (trimmedText) {
        const paragraphs = text.split(/\n\s*\n/).filter((paragraph) => paragraph.trim());
        paragraphCount = paragraphs.length;
    }

    // Average Sentence Length (in words)
    let avgSentenceLength = '0.00'; // Default to string "0.00"
    if (sentenceCount > 0) {
        const totalWordsInSentences = words.length; // Assuming all words belong to some sentence
        avgSentenceLength = (totalWordsInSentences / sentenceCount).toFixed(2);
    }

    // Punctuation Counts
    let periodCount = 0;
    let commaCount = 0;
    let questionCount = 0;
    let exclamationCount = 0;

    for (let index = 0; index < text.length; index++) {
        const char = text[index];
        if (char === '.') {
            periodCount++;
        } else if (char === ',') {
            commaCount++;
        } else if (char === '?') {
            questionCount++;
        } else if (char === '!') {
            exclamationCount++;
        }
    }

    // Word Frequency Analysis
    const wordFrequency: Record<string, number> = {};
    if (words.length > 0) {
        words.forEach((word) => {
            // Clean word: remove punctuation and convert to lowercase
            const cleanWord = word.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
            if (cleanWord && cleanWord.length > 0 && !STOP_WORDS.has(cleanWord)) {
                wordFrequency[cleanWord] = (wordFrequency[cleanWord] || 0) + 1;
            }
        });
    }

    // Get top 5 most frequent words
    const topWords: WordFrequencyEntry[] = Object.entries(wordFrequency)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 5)
        .map(([word, count]) => ({ word, count }));

    return {
        charCount,
        wordCount,
        lineCount,
        sentenceCount,
        paragraphCount,
        avgWordLength,
        avgSentenceLength,
        periodCount,
        commaCount,
        questionCount,
        exclamationCount,
        wordFrequency: topWords
    };
}
