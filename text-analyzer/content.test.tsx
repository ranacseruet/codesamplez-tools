import { render } from 'preact';
import { FAQ_ITEMS, SAMPLE_GUIDE_STATS, TextAnalyzerIntro, TextAnalyzerArticle } from './content';
import { analyzeText } from './TextAnalyzer';
import { TEXT_ANALYZER_SAMPLE_TEXT } from './sample-text';

describe('text-analyzer content', () => {
    it('keeps every FAQ answer self-contained and in parity with its structured-data answer', () => {
        expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(8);
        expect(FAQ_ITEMS.map((item) => item.question)).toEqual(expect.arrayContaining([
            'How does the keyword density calculation work?',
            'Is my text uploaded anywhere?',
            'What counts as a word, including text without spaces?'
        ]));

        FAQ_ITEMS.forEach((item) => {
            expect(typeof item.question).toBe('string');
            expect(item.question.trim().length).toBeGreaterThan(0);
            expect(typeof item.answer).toBe('string');
            expect(typeof item.answer === 'string' ? item.answer.trim().length : 0).toBeGreaterThan(0);
            expect(item.answer).toBe(item.structuredDataAnswer);
        });
    });

    it('has no duplicate questions in FAQ_ITEMS', () => {
        const questions = FAQ_ITEMS.map((item) => item.question.trim().toLowerCase());
        expect(new Set(questions).size).toBe(questions.length);
    });

    it('renders the intro section with lead description', () => {
        document.body.innerHTML = '<div id="test-intro"></div>';
        const root = document.getElementById('test-intro');

        render(<TextAnalyzerIntro />, root!);

        const heading = root!.querySelector('#text-analyzer-intro-heading');
        expect(heading).not.toBeNull();
        expect(heading!.textContent).toBe('About This Tool');

        const lead = root!.querySelector('.c-tool-article__lead');
        expect(lead).not.toBeNull();
        expect(lead!.textContent).toContain('CodeSamplez Text Analyzer');
    });

    it('renders the article with structured guide sections and FAQs', () => {
        document.body.innerHTML = '<div id="test-article"></div>';
        const root = document.getElementById('test-article');

        render(<TextAnalyzerArticle />, root!);

        expect(root!.querySelector('#what-is-text-analyzer')).not.toBeNull();
        expect(root!.querySelector('#text-analyzer-keyword-analysis')?.textContent).toContain('Keyword and Key Phrase Analysis');
        expect(root!.querySelector('#text-analyzer-how-to-analyze')?.textContent).toContain('How to Analyze Text');
        expect(root!.querySelector('#text-analyzer-features')).not.toBeNull();
        expect(root!.querySelector('#how-to-use-text-analyzer')).not.toBeNull();
        expect(root!.querySelector('#text-analyzer-limitations')).not.toBeNull();
        const privacy = root!.querySelector('#text-analyzer-privacy');
        expect(privacy).not.toBeNull();
        expect(privacy!.closest('section')!.textContent).toContain(
            'Your input is processed in this browser and is not uploaded by the tool. This site uses Google Analytics and Google AdSense cookies to measure usage and show ads.'
        );
        expect(root!.querySelector('#text-analyzer-faqs')).not.toBeNull();

        const renderedFaqQuestions = root!.querySelectorAll('.c-tool-faq__item');
        expect(renderedFaqQuestions.length).toBe(FAQ_ITEMS.length);
        expect(root!.textContent).toContain('How does the keyword density calculation work?');
        expect(root!.textContent).toContain('Is my text uploaded anywhere?');
        expect(root!.textContent).toContain('not uploaded by the tool');
    });

    it('quotes the built-in sample with the numbers the analyzer returns', () => {
        const result = analyzeText(TEXT_ANALYZER_SAMPLE_TEXT);

        expect(result).toMatchObject({
            charCount: 107,
            wordCount: 19,
            lineCount: 3,
            sentenceCount: 3,
            paragraphCount: 2,
            avgWordLength: '4.42',
            avgSentenceLength: '6.33',
            readingTime: 1,
            readabilityScore: 71.28,
            gradeLevel: 4.89,
            keywordDensity: 5.26,
            topKeyword: 'sample',
            periodCount: 2,
            commaCount: 0,
            questionCount: 0,
            exclamationCount: 1
        });
        expect(result.wordFrequency).toEqual([
            { word: 'sample', count: 1 },
            { word: 'text', count: 1 },
            { word: 'analysis', count: 1 },
            { word: 'multiple', count: 1 },
            { word: 'sentences', count: 1 }
        ]);

        document.body.innerHTML = '<div id="test-sample"></div>';
        const root = document.getElementById('test-sample');
        render(<TextAnalyzerArticle />, root!);

        const guide = root!.querySelector('#text-analyzer-how-to-analyze')?.closest('section');
        expect(guide).not.toBeNull();
        expect(guide!.querySelector('code')?.textContent).toBe(TEXT_ANALYZER_SAMPLE_TEXT);
        SAMPLE_GUIDE_STATS.forEach((stat) => {
            expect(guide!.textContent).toContain(`${stat.label}:`);
            expect(guide!.textContent).toContain(stat.value);
        });
        expect(guide!.textContent).toContain('sample, text, analysis, multiple, sentences');
        expect(guide!.textContent).toContain('sample — 5.26%');

        const keywords = root!.querySelector('#text-analyzer-keyword-analysis')?.closest('section');
        expect(keywords!.textContent).toContain('does not score a multi-word key phrase');
        expect(keywords!.textContent).toContain('“text analysis tool”');
        expect(keywords!.textContent).not.toContain('&ldquo;');
        expect(keywords!.textContent).not.toContain('&apos;');
        expect(keywords!.textContent).toContain('Intl.Segmenter');
        expect(keywords!.textContent).toContain('state-of-the-art');
        expect(keywords!.textContent).toContain('Korean Hangul');
        expect(root!.querySelector('.c-tool-tutorial__link')).toBeNull();
    });
});
