import { analyzeText, countSyllables, extractWords, maskAbbreviationPeriods } from './TextAnalyzer';

describe('TextAnalyzer', () => {
    describe('countSyllables', () => {
        it('returns 0 for empty or non-alphabetical input', () => {
            expect(countSyllables('')).toBe(0);
            expect(countSyllables('123')).toBe(0);
            expect(countSyllables('!@#')).toBe(0);
        });

        it('handles short words (<= 3 chars) as 1 syllable', () => {
            expect(countSyllables('a')).toBe(1);
            expect(countSyllables('the')).toBe(1);
            expect(countSyllables('cat')).toBe(1);
        });

        it('handles words ending with silent e', () => {
            expect(countSyllables('game')).toBe(1);
            expect(countSyllables('lake')).toBe(1);
            expect(countSyllables('time')).toBe(1);
        });

        it('handles words ending with consonant + le', () => {
            expect(countSyllables('table')).toBe(2);
            expect(countSyllables('simple')).toBe(2);
            expect(countSyllables('little')).toBe(2);
        });

        it('counts syllables correctly for multi-syllable words', () => {
            expect(countSyllables('reading')).toBe(2);
            expect(countSyllables('syllable')).toBe(3);
            expect(countSyllables('beautiful')).toBe(3);
        });
    });

    describe('Word Count', () => {
        it('returns 0 words for empty string or null/undefined', () => {
            expect(analyzeText('').wordCount).toBe(0);
            expect(analyzeText(undefined).wordCount).toBe(0);
        });

        it('counts words with multiple spaces correctly', () => {
            const text = 'The   quick  brown    fox';
            expect(analyzeText(text).wordCount).toBe(4);
        });

        it('counts words separated by newlines correctly', () => {
            const text = 'The quick\nbrown fox';
            expect(analyzeText(text).wordCount).toBe(4);
        });

        it('counts multiple words in Chinese text without spaces (issue #44)', () => {
            const text = '今天天气很好，我们去公园散步，然后吃了午饭。';
            expect(analyzeText(text).wordCount).toBeGreaterThan(1);
        });

        it('counts multiple words in Japanese text without spaces', () => {
            const text = '猫が座った。今日は晴れです。';
            expect(analyzeText(text).wordCount).toBeGreaterThan(1);
        });

        it('reports more than one word for a long CJK paragraph', () => {
            const text = '这是一段很长的中文段落'.repeat(60);
            const result = analyzeText(text);
            expect(result.wordCount).toBeGreaterThan(100);
            expect(result.avgWordLength).not.toBe('0.00');
        });

        it('keeps English word counting unchanged for hyphenated compounds', () => {
            expect(extractWords("don't stop state-of-the-art now")).toHaveLength(4);
        });

        it('falls back to whitespace splitting for space-delimited scripts', () => {
            expect(extractWords('The quick brown fox')).toEqual(['The', 'quick', 'brown', 'fox']);
        });
    });

    describe('Character Count', () => {
        it('returns 0 characters for empty string', () => {
            expect(analyzeText('').charCount).toBe(0);
        });

        it('counts all characters including spaces and punctuation', () => {
            const text = 'Hello, World!';
            expect(analyzeText(text).charCount).toBe(13);
        });
    });

    describe('Paragraph Count', () => {
        it('returns 0 paragraphs for empty string', () => {
            expect(analyzeText('').paragraphCount).toBe(0);
        });

        it('counts single paragraph correctly', () => {
            expect(analyzeText('Single paragraph text.').paragraphCount).toBe(1);
        });

        it('counts multiple paragraphs separated by blank lines', () => {
            const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
            expect(analyzeText(text).paragraphCount).toBe(3);
        });
    });

    describe('Line Count', () => {
        it('returns 0 lines for empty string', () => {
            expect(analyzeText('').lineCount).toBe(0);
        });

        it('counts lines separated by newlines', () => {
            const text = 'Line 1\nLine 2\nLine 3';
            expect(analyzeText(text).lineCount).toBe(3);
        });
    });

    describe('Sentence Count', () => {
        it('returns 0 sentences for empty string', () => {
            expect(analyzeText('').sentenceCount).toBe(0);
        });

        it('returns 0 sentences for punctuation-only input', () => {
            expect(analyzeText('...').sentenceCount).toBe(0);
            expect(analyzeText('???').sentenceCount).toBe(0);
        });

        it('counts sentences ending with periods, exclamation marks, and question marks', () => {
            const text = 'First sentence. Second sentence! Third sentence?';
            expect(analyzeText(text).sentenceCount).toBe(3);
        });

        it('counts a sentence without ending punctuation', () => {
            const text = 'Sentence without terminal punctuation';
            expect(analyzeText(text).sentenceCount).toBe(1);
        });

        it('handles mixed punctuation with a trailing incomplete sentence', () => {
            const text = 'Hello world! How are you? Doing well';
            expect(analyzeText(text).sentenceCount).toBe(3);
        });

        it('does not split sentences on common abbreviations (issue #44)', () => {
            const text = 'Dr. Smith met Mr. Jones at 5 p.m. in Washington, D.C. yesterday. The meeting went well.';
            expect(analyzeText(text).sentenceCount).toBe(2);
        });

        it('does not split on other titles and honorifics', () => {
            expect(analyzeText('Prof. Lee arrived early. Class began.').sentenceCount).toBe(2);
            expect(analyzeText('Mrs. Chen and Ms. Patel met Dr. Ortega.').sentenceCount).toBe(1);
        });

        it('ends sentences at name-suffix abbreviations followed by a capitalized word', () => {
            expect(analyzeText('His son is Martin King Jr. He lives elsewhere.').sentenceCount).toBe(2);
            expect(analyzeText('Ortega Sr. He gave the keynote.').sentenceCount).toBe(2);
        });

        it('keeps name-suffix abbreviations mid-sentence when lowercase follows', () => {
            expect(analyzeText('Martin Luther King Jr. gave a speech.').sentenceCount).toBe(1);
        });

        it('does not split on lowercase Latin abbreviations mid-sentence', () => {
            expect(analyzeText('Use tools, e.g. hammers and nails, with care.').sentenceCount).toBe(1);
            expect(analyzeText('Bring tools, etc. and be ready.').sentenceCount).toBe(1);
        });

        it('still ends sentences when an abbreviation is followed by a capitalized word', () => {
            expect(analyzeText('Apples, bananas, etc. Next topic.').sentenceCount).toBe(2);
            expect(analyzeText('He lives in the U.S. She does not.').sentenceCount).toBe(2);
            expect(analyzeText('The party starts at 9 p.m. Bring drinks.').sentenceCount).toBe(2);
        });

        it('keeps spaced initials together as one sentence', () => {
            expect(analyzeText('J. K. Rowling wrote it. It sold well.').sentenceCount).toBe(2);
        });

        it('treats a trailing abbreviation period as the sentence terminator', () => {
            expect(analyzeText('She moved to Washington, D.C.').sentenceCount).toBe(1);
        });

        it('leaves text without abbreviations unchanged', () => {
            expect(maskAbbreviationPeriods('One two three. Four! Five?')).toBe('One two three. Four! Five?');
        });
    });

    describe('Average Word and Sentence Length', () => {
        it('defaults averages to "0.00" for empty input', () => {
            const result = analyzeText('');
            expect(result.avgWordLength).toBe('0.00');
            expect(result.avgSentenceLength).toBe('0.00');
        });

        it('calculates average word length stripping punctuation', () => {
            // "Hello," (5) + "world!" (5) = 10 / 2 = 5.00
            const text = 'Hello, world!';
            expect(analyzeText(text).avgWordLength).toBe('5.00');
        });

        it('calculates average sentence length in words per sentence', () => {
            // 6 words across 2 sentences = 3.00
            const text = 'One two three. Four five six.';
            expect(analyzeText(text).avgSentenceLength).toBe('3.00');
        });
    });

    describe('Reading Time & Readability Metrics', () => {
        it('returns null readability metrics for empty input', () => {
            const result = analyzeText('');
            expect(result.readingTime).toBe(0);
            expect(result.readabilityScore).toBeNull();
            expect(result.gradeLevel).toBeNull();
        });

        it('computes reading time (at least 1 minute for non-empty text)', () => {
            const result = analyzeText('A short phrase.');
            expect(result.readingTime).toBe(1);
        });

        it('computes Flesch Reading Ease and Flesch-Kincaid Grade Level', () => {
            const text = 'The cat sat on the mat. It was a very good cat.';
            const result = analyzeText(text);

            expect(result.readabilityScore).not.toBeNull();
            expect(typeof result.readabilityScore).toBe('number');
            expect(result.gradeLevel).not.toBeNull();
            expect(typeof result.gradeLevel).toBe('number');
        });

        it('calculates top keyword density against total word count, filtering stop words', () => {
            const text = 'alpha alpha the beta';
            const result = analyzeText(text);

            // "the" is a stop word. "alpha" appears 2 times out of 4 words = 50.00%
            expect(result.topKeyword).toBe('alpha');
            expect(result.keywordDensity).toBe(50.0);
        });

        it('ignores numeric-only tokens as keyword candidates', () => {
            const text = '12 12 alpha.';
            const result = analyzeText(text);

            expect(result.wordFrequency).toEqual([{ word: 'alpha', count: 1 }]);
            expect(result.topKeyword).toBe('alpha');
            expect(result.keywordDensity).toBe(33.33);
        });

        it('returns 0 keyword density and null topKeyword when text has no non-stop words', () => {
            const text = 'the and or but';
            const result = analyzeText(text);

            expect(result.topKeyword).toBeNull();
            expect(result.keywordDensity).toBe(0);
        });
    });

    describe('Punctuation Stats', () => {
        it('returns 0 for all punctuation counts on empty string', () => {
            const result = analyzeText('');
            expect(result.periodCount).toBe(0);
            expect(result.commaCount).toBe(0);
            expect(result.questionCount).toBe(0);
            expect(result.exclamationCount).toBe(0);
        });

        it('counts all punctuation marks correctly', () => {
            const text = 'Hello, world! How are you? This is great.... Wait, really!';
            const result = analyzeText(text);

            expect(result.periodCount).toBe(4);
            expect(result.commaCount).toBe(2);
            expect(result.questionCount).toBe(1);
            expect(result.exclamationCount).toBe(2);
        });
    });

    describe('Word Frequency Analysis', () => {
        it('returns empty array when text has no words or only punctuation', () => {
            expect(analyzeText('!!! ??? ...').wordFrequency).toEqual([]);
        });

        it('counts single word with frequency 1', () => {
            expect(analyzeText('hello').wordFrequency).toEqual([
                { word: 'hello', count: 1 }
            ]);
        });

        it('counts word frequency sorted by count descending and case-insensitively', () => {
            const text = 'Hello hello HELLO world World sample';
            expect(analyzeText(text).wordFrequency).toEqual([
                { word: 'hello', count: 3 },
                { word: 'world', count: 2 },
                { word: 'sample', count: 1 }
            ]);
        });

        it('strips punctuation when calculating word frequencies', () => {
            const text = 'hello, world! hello. test? hello!';
            expect(analyzeText(text).wordFrequency).toEqual([
                { word: 'hello', count: 3 },
                { word: 'world', count: 1 },
                { word: 'test', count: 1 }
            ]);
        });

        it('returns only the top 5 most frequent words', () => {
            // apple:5, banana:4, cherry:3, date:2, elderberry:1, fig:1
            const text = 'apple banana cherry date elderberry fig apple banana cherry date apple banana cherry apple banana apple';
            const result = analyzeText(text);

            expect(result.wordFrequency).toHaveLength(5);
            expect(result.wordFrequency?.[0]).toEqual({ word: 'apple', count: 5 });
            expect(result.wordFrequency?.[1]).toEqual({ word: 'banana', count: 4 });
            expect(result.wordFrequency?.[2]).toEqual({ word: 'cherry', count: 3 });
            expect(result.wordFrequency?.[3]).toEqual({ word: 'date', count: 2 });
            expect(result.wordFrequency?.[4]).toEqual({ word: 'elderberry', count: 1 });
        });
    });
});
