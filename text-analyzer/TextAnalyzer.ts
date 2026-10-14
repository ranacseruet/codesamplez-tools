const STOP_WORDS = new Set(
    'a an the and or but in on at to for of with by from as is are was were be been being have has had do does did will would could should may might must can shall this that these those i me my myself we our ours you your yours he him his she her hers it its they them their theirs up down out about into through during before after above below between among under over again further then once here there when where why how all any both each few more most other some such no nor not only own same so than too very s t just don now d ll m o re ve y ain aren couldn didn doesn hadn hasn haven isn ma mightn mustn needn shan shouldn wasn weren won wouldn'.split(' ')
);

const WORDS_PER_MINUTE = 200;

type IntlSegmentLike = {
    segment: string;
    isWordLike?: boolean;
};

type IntlSegmenterLike = {
    segment(input: string): Iterable<IntlSegmentLike>;
};

// Scripts that do not separate words with spaces, so whitespace splitting
// reports whole paragraphs as a single word. Hangul is excluded because
// Korean text conventionally uses spaces between words.
const NO_SPACE_SCRIPT_PATTERN = /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Thai}|\p{Script=Khmer}|\p{Script=Lao}|\p{Script=Myanmar}/u;

/**
 * Extract word tokens for counting and downstream metrics. Whitespace
 * splitting cannot see word boundaries in scripts that do not use spaces
 * (Chinese, Japanese, Thai), so those inputs are handed to a locale-aware
 * Intl.Segmenter when the runtime provides one; space-delimited text keeps
 * the plain whitespace split, which matches the conventional word count
 * (hyphenated compounds stay one word).
 */
export function extractWords(text: string): string[] {
    const trimmedText = text.trim();
    if (!trimmedText) {
        return [];
    }

    const segmenterCtor = (globalThis as { Intl?: { Segmenter?: new (locale: string, options: { granularity: 'word' }) => IntlSegmenterLike } }).Intl?.Segmenter;
    if (segmenterCtor && NO_SPACE_SCRIPT_PATTERN.test(trimmedText)) {
        const segmenter = new segmenterCtor('en', { granularity: 'word' });
        return Array.from(segmenter.segment(trimmedText), (item) => item)
            .filter((segment) => segment.isWordLike === true)
            .map((segment) => segment.segment);
    }

    return trimmedText.split(/\s+/);
}

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

// Periods following these abbreviations are essentially never sentence
// terminators, so they are masked before sentence splitting regardless of
// what follows ("Dr. Smith", "Team A vs. Team B").
const SENTENCE_ALWAYS_SAFE_ABBREVIATIONS = [
    'Mr', 'Mrs', 'Ms', 'Messrs', 'Dr', 'Prof', 'St', 'Sr', 'Jr', 'Mt',
    'Rev', 'Hon', 'Gen', 'Col', 'Lt', 'Sgt', 'Capt', 'Sen', 'Rep', 'Gov',
    'Pres', 'vs'
];

// Other abbreviations and initialisms (e.g. "U.S.", "p.m.", "Ph.D.", "etc.")
// are only masked when clearly continuing into more of the same sentence:
// a following lowercase word, or another lettered abbreviation. A following
// capitalized word is left as a real boundary ("...at 5 p.m. The next day").
// Capitalized company-suffix spellings are listed explicitly.
const SENTENCE_CONTINUING_ABBREVIATIONS = ['etc', 'cf', 'viz', 'al', 'inc', 'Inc', 'ltd', 'Ltd'];

// Placeholder substituted for periods that must not terminate sentences.
// A private-use code point can never appear in normal input and is not
// matched by the [.!?] terminator class.
const SENTENCE_PERIOD_PLACEHOLDER = '\uE000';

/**
 * Replace periods that follow known abbreviations with a placeholder so the
 * sentence splitter does not treat them as sentence boundaries. Only periods
 * followed by whitespace or end of input matter, because a period attached to
 * more text (as in "Ph.D" or "U.S.A") can never terminate a sentence.
 */
export function maskAbbreviationPeriods(text: string): string {
    let maskedText = text.replace(
        new RegExp(`\\b(${SENTENCE_ALWAYS_SAFE_ABBREVIATIONS.join('|')})\\.(?=\\s|$)`, 'g'),
        (_match, abbreviation: string) => abbreviation + SENTENCE_PERIOD_PLACEHOLDER
    );

    // Initialisms: runs of letter+period groups like "U.S.", "D.C.", "e.g.",
    // "i.e.", "a.m.", "p.m.", "Ph.D.". Mask the final period when a lowercase
    // word or another abbreviation continues the sentence.
    maskedText = maskedText.replace(
        /\b(?:\p{L}+\.)+\p{L}\.(?=\s+[a-z]|\s+\p{L}+\.)/gu,
        (match) => `${match.slice(0, -1)}${SENTENCE_PERIOD_PLACEHOLDER}`
    );

    maskedText = maskedText.replace(
        new RegExp(`\\b(${SENTENCE_CONTINUING_ABBREVIATIONS.join('|')})\\.(?=\\s+[a-z]|\\s+\\p{L}+\\.)`, 'gu'),
        (_match, abbreviation: string) => abbreviation + SENTENCE_PERIOD_PLACEHOLDER
    );

    // Single-letter tokens: initials ("J. K. Rowling"). Masked when a lowercase
    // word, another initial, or a capitalized word follows, which is the
    // shape of a name continuation rather than a sentence end. The lookbehind
    // skips letters that belong to an initialism run ("U.S."), which the run
    // rule above already evaluated correctly.
    maskedText = maskedText.replace(
        /(?<!\p{L}\.)\b\p{L}\.(?=\s+[a-z]|\s+\p{L}\.|\s+\p{Lu}\p{Ll})/gu,
        (match) => `${match.slice(0, -1)}${SENTENCE_PERIOD_PLACEHOLDER}`
    );

    return maskedText;
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

    // Word count: prefer Intl.Segmenter so CJK text (which has no spaces)
    // is segmented into words; falls back to whitespace splitting.
    const words = extractWords(text);
    const wordCount = words.length;

    // Average Word Length: calculate after stripping punctuation. Letter and
    // number classes are Unicode-aware so CJK words keep their length.
    const totalWordLength = words.reduce((sum, word) => sum + word.replace(/[^\p{L}\p{N}]/gu, '').length, 0);
    const avgWordLength = wordCount > 0 ? (totalWordLength / wordCount).toFixed(2) : '0.00';

    // Line count: split on newlines, but return 0 for empty string
    const lineCount = text ? text.split('\n').length : 0;

    // Sentence count. Periods protected by maskAbbreviationPeriods are
    // hidden from the terminator class, so "Dr. Smith met Mr. Jones at
    // 5 p.m." stays a single sentence.
    let sentenceCount = 0;
    const trimmedText = text.trim();
    if (trimmedText) {
        const maskedText = maskAbbreviationPeriods(trimmedText);
        const sentencePieces = maskedText.split(/[.!?]+(?:\s+|$)/);
        sentenceCount = sentencePieces.filter((piece) => piece.trim()).length;
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
            const cleanWord = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
            if (cleanWord && /\p{L}/u.test(cleanWord) && !STOP_WORDS.has(cleanWord)) {
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
