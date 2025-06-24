// Handle both ES6 and CommonJS environments
let NotificationManager = {
    // istanbul ignore next
    show: () => {} // Default mock implementation
};

if (typeof module !== 'undefined' && module.exports) {
    // CommonJS environment (Node.js/Jest)
    try {
        const notificationModule = require('../common/notification-manager.js');
        NotificationManager = notificationModule.NotificationManager || notificationModule;
    } catch (e) {
        // Keep the default mock implementation
        console.warn('NotificationManager not available, using mock');
    }
} else {
    // ES6 environment (browser)
    // istanbul ignore next
    try {
        import('../common/notification-manager.js').then(module => {
            NotificationManager = module.NotificationManager || module;
        }).catch(() => {
            console.warn('NotificationManager not available, using mock');
        });
    } catch (e) {
        console.warn('NotificationManager not available, using mock');
    }
}

export class TextAnalyzerUI {
    constructor() {
        this.textInput = document.getElementById('textInput');
        this.clearButton = document.getElementById('clear-input');
        this.loadSampleButton = document.getElementById('load-sample');
        this.loadingIndicator = document.getElementById('loading-indicator');

        this.elements = {
            charCount: document.getElementById('charCount'),
            wordCount: document.getElementById('wordCount'),
            lineCount: document.getElementById('lineCount'),
            sentenceCount: document.getElementById('sentenceCount'),
            paragraphCount: document.getElementById('paragraphCount'),
            avgWordLength: document.getElementById('avgWordLength'),
            avgSentenceLength: document.getElementById('avgSentenceLength'),
            periodCount: document.getElementById('periodCount'),
            commaCount: document.getElementById('commaCount'),
            questionCount: document.getElementById('questionCount'),
            exclamationCount: document.getElementById('exclamationCount')
        };

        // Web Worker setup
        this.worker = null;
        this.initWorker();

        // Cache for results
        this.cachedText = '';
        this.cachedResult = null;

        this.initializeEventListeners();
    }

    initWorker() {
        // Check if Web Workers are supported
        if (typeof Worker === 'undefined') {
            console.error('Web Workers not supported in this environment');
            NotificationManager.show("Web Workers not supported - this tool requires a modern browser", 5000, {type: 'error'});
            return;
        }

        try {
            // Dynamic worker path resolution based on current script location
            let workerPath = './text-analyzer.worker.js'; // Default for development
            
            // Only override for production-like environments
            if (typeof window !== 'undefined' && window.location) {
                const pathSegments = window.location.pathname.split('/');
                // Check if we're likely in a production environment
                if (pathSegments.includes('tools') && !window.location.port) {
                    workerPath = 'text-analyzer-tool/text-analyzer.worker.js';
                }
            }
            
            console.log('Initializing worker with path:', workerPath);
            this.worker = new Worker(workerPath);
            
            this.worker.onmessage = (e) => {
                console.log('Worker message received:', e.data);
                const response = e.data;
                
                if (this.loadingIndicator) {
                    this.loadingIndicator.style.display = 'none';
                }

                if (response.success) {
                    this.updateUI(response.data);
                    // Update cache with successful result
                    this.cachedResult = response.data;
                    NotificationManager.show("Analysis complete", 3000, {type: 'success'});
                } else {
                    console.error('Worker analysis failed:', response.error);
                    NotificationManager.show(`Analysis error: ${response.error}`, 5000, {type: 'error'});
                }
            };
            
            this.worker.onerror = (error) => {
                console.error('Worker error:', error);
                if (this.loadingIndicator) {
                    this.loadingIndicator.style.display = 'none';
                }
                NotificationManager.show("Worker error occurred - analysis failed", 5000, {type: 'error'});
            };
            
            console.log('Worker initialized successfully');
        } catch (error) {
            console.error('Failed to create worker:', error);
            this.worker = null;
            NotificationManager.show("Worker initialization failed - this tool requires a modern browser with Web Worker support", 5000, {type: 'error'});
        }
    }

    updateCounts() {
        if (!this.textInput) return;
        const text = this.textInput.value;

        // Check cache first
        if (text === this.cachedText && this.cachedResult) {
            this.updateUI(this.cachedResult);
            return;
        }

        // Check if worker is available
        if (!this.worker) {
            NotificationManager.show("Analysis unavailable - Web Worker not initialized. Please use a modern browser.", 5000, {type: 'error'});
            return;
        }

        // Show loading indicator for analysis
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'block';
        }

        // Use Web Worker for analysis
        this.cachedText = text;
        this.worker.postMessage(text);
    }

    updateUI(result) {
        Object.entries(result).forEach(([key, value]) => {
            if (this.elements[key]) {
                this.elements[key].textContent = String(value);
            }
        });
    }

    initializeEventListeners() {
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => {
                this.textInput.value = '';
                this.updateCounts();
                NotificationManager.show("Text cleared", 3000, {type: 'success'});
            });
        }

        if (this.loadSampleButton) {
            this.loadSampleButton.addEventListener('click', () => {
                const sampleText = "This is a sample text for analysis. It has multiple sentences and paragraphs.\n\nLet's see how well it works!";
                this.textInput.value = sampleText;
                NotificationManager.show("Sample text loaded", 3000, {type: 'success'});
            });
        }

        const analyzeButton = document.getElementById('analyze-button');
        if (analyzeButton) {
            analyzeButton.addEventListener('click', () => {
                this.updateCounts();
                NotificationManager.show("Analysis triggered", 3000, {type: 'success'});
            });
        }
    }
}

// Export for both ES modules and CommonJS
export default TextAnalyzerUI;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextAnalyzerUI;
}
