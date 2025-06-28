import '@testing-library/jest-dom';
import { JSDOM } from 'jsdom';
import path from 'path';
import fs from 'fs';
import { screen, getByText, fireEvent } from '@testing-library/dom';

const html = fs.readFileSync(path.resolve(__dirname, './index.html'), 'utf8');

let dom;
let container;

// Mock QRCode library
const mockQRCode = {
  toCanvas: (canvas, text, options, callback) => {
    // Simulate successful QR code generation
    callback(null);
  }
};

describe('QRCodeGeneratorUI', () => {
  beforeEach(() => {
    dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    container = dom.window.document.body;
    
    // Add mocked QRCode to window
    dom.window.QRCode = mockQRCode;
  });

  it('should render the QR code generator', () => {
    expect(container.querySelector('#qr-code-generator-tool')).not.toBeNull();
  });

  it('should generate a QR code when text is entered', async () => {
    const script = fs.readFileSync(path.resolve(__dirname, './script.js'), 'utf8');
    const scriptElement = dom.window.document.createElement('script');
    scriptElement.textContent = script;
    dom.window.document.body.appendChild(scriptElement);

    const qrText = container.querySelector('#qr-text');
    fireEvent.input(qrText, { target: { value: 'https://example.com' } });

    // Wait for the debounce timer
    await new Promise(resolve => setTimeout(resolve, 300));

    const canvas = container.querySelector('#qr-canvas');
    expect(canvas.style.display).not.toBe('none');
  });
});
