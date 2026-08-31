const STOP_WORDS = new Set(
    'a an the and or but in on at to for of with by from as is are was were be been being have has had do does did will would could should may might must can shall this that these those i me my myself we our ours you your yours he him his she her hers it its they them their theirs up down out about into through during before after above below between among under over again further then once here there when where why how all any both each few more most other some such no nor not only own same so than too very s t just don now d ll m o re ve y ain aren couldn didn doesn hadn hasn haven isn ma mightn mustn needn shan shouldn wasn weren won wouldn'.split(' ')
);

const WORDS_PER_MINUTE = 200;

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
    readingTime: number;
    readabilityScore: number | null;
    gradeLevel: number | null;
    keywordDensity: number;
    topKeyword: string | null;
    periodCount: number;
    commaCount: number;
    questionCount: number;
    exclamationCount: number;
    wordFrequency?: WordFrequencyEntry[];
};

/**
 * Estimate syllables with a small, dependency-free English heuristic.
 * Vowel groups provide the base count; a final silent e is removed, while a
 * consonant + le ending adds the syllable that the silent-e rule would miss.
 */
export function countSyllables(word: string): number {
    const normalizedWord = String(word).toLowerCase().replace(/[^a-z]/g, '');
    if (!normalizedWord) {
        return 0;
    }

    if (normalizedWord.length <= 3) {
        return 1;
    }

    const wordWithoutSilentE = normalizedWord.endsWith('e')
        ? normalizedWord.slice(0, -1)
        : normalizedWord;
    const vowelGroups = wordWithoutSilentE.match(/[aeiouy]+/g);
    let syllables = vowelGroups?.length || 1;

    if (
        normalizedWord.endsWith('le')
        && !/[aeiouy]/.test(normalizedWord[normalizedWord.length - 3])
    ) {
        syllables += 1;
    }

    return Math.max(syllables, 1);
}

function roundMetric(value: number): number {
    return Number(value.toFixed(2));
}

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
            readingTime: 0,
            readabilityScore: null,
            gradeLevel: null,
            keywordDensity: 0,
            topKeyword: null,
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

    // Reading time is rounded up so even a short non-empty text is shown as
    // one minute, matching the convention users expect from reading-time
    // estimates.
    const readingTime = Math.ceil(wordCount / WORDS_PER_MINUTE);

    // Flesch metrics are intended for English text. Use words containing
    // English letters for the syllable estimate so punctuation-only tokens do
    // not distort the syllable average, while retaining the analyzer's full
    // word count for the words-per-sentence term.
    const readabilityWords = words.filter((word) => /[a-z]/i.test(word));
    const readabilityWordCount = readabilityWords.length;
    const totalSyllables = readabilityWords.reduce((sum, word) => sum + countSyllables(word), 0);
    const averageWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
    const averageSyllablesPerWord = readabilityWordCount > 0 ? totalSyllables / readabilityWordCount : 0;
    const hasReadabilityMetrics = readabilityWordCount > 0 && sentenceCount > 0;
    // Flesch Reading Ease = 206.835 - (1.015 * words/sentences)
    //     - (84.6 * syllables/words).
    // Flesch-Kincaid Grade = (0.39 * words/sentences)
    //     + (11.8 * syllables/words) - 15.59.
    const readabilityScore = hasReadabilityMetrics
        ? roundMetric(
            206.835
            - 1.015 * averageWordsPerSentence
            - 84.6 * averageSyllablesPerWord
        )
        : null;
    const gradeLevel = hasReadabilityMetrics
        ? roundMetric(
            0.39 * averageWordsPerSentence
            + 11.8 * averageSyllablesPerWord
            - 15.59
        )
        : null;

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
            if (cleanWord && /[a-zA-Z]/.test(cleanWord) && !STOP_WORDS.has(cleanWord)) {
                wordFrequency[cleanWord] = (wordFrequency[cleanWord] || 0) + 1;
            }
        });
    }

    // Get top 5 most frequent words
    const topWords: WordFrequencyEntry[] = Object.entries(wordFrequency)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 5)
        .map(([word, count]) => ({ word, count }));

    const topKeywordEntry = topWords[0] ?? null;
    const topKeyword = topKeywordEntry?.word ?? null;
    // Report the density of the most frequent non-stop word. The denominator
    // intentionally uses the analyzer's total word count so the percentage is
    // comparable with the other word-count metrics.
    const keywordDensity = topKeywordEntry
        ? roundMetric((topKeywordEntry.count / wordCount) * 100)
        : 0;

    return {
        charCount,
        wordCount,
        lineCount,
        sentenceCount,
        paragraphCount,
        avgWordLength,
        avgSentenceLength,
        readingTime,
        readabilityScore,
        gradeLevel,
        keywordDensity,
        topKeyword,
        periodCount,
        commaCount,
        questionCount,
        exclamationCount,
        wordFrequency: topWords
    };
}
