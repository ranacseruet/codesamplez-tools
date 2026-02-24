import QRCode from 'qrcode';
import DownloadManager from '../common/DownloadManager';
import ClearButton from '../common/clear-button/ClearButton.js';
import { hydrate, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { mountToolShell } from '../common/app-shell/mountToolShell.js';

const QR_EMPTY_INPUT_MESSAGE = 'Please enter text or a URL to generate a QR code.';
const QR_TOO_LONG_ERROR_MESSAGE = 'Error: Input data is too long for the selected error correction level. Try reducing data or increasing error correction.';

export class QRCodeGeneratorUI {
  constructor(options) {
    this.qrText = document.getElementById(options.qrTextId);
    this.qrSize = document.getElementById(options.qrSizeId);
    this.sizeLabel = document.getElementById(options.sizeLabelId);
    this.qrMargin = document.getElementById(options.qrMarginId);
    this.marginLabel = document.getElementById(options.marginLabelId);
    this.errorCorrection = document.getElementById(options.errorCorrectionId);
    this.qrCanvas = document.getElementById(options.qrCanvasId);
    this.downloadBtn = document.getElementById(options.downloadBtnId);
    this.errorMessage = document.getElementById(options.errorMessageId);
    this.downloadManager = new DownloadManager();

    // Initialize ClearButton
    if (this.qrText) {
      this.clearButton = new ClearButton(this.qrText);
    }

    this.debounceTimer = null;
    this.bindEvents();
    this.initializeApp();
  }

  generateQRCode() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const text = this.qrText.value;
      if (!text) {
        this.qrCanvas.style.display = 'none';
        this.errorMessage.textContent = QR_EMPTY_INPUT_MESSAGE;
        return;
      }

      this.qrCanvas.style.display = 'block';
      this.errorMessage.textContent = '';

      const options = {
        text: text,
        width: parseInt(this.qrSize.value, 10),
        height: parseInt(this.qrSize.value, 10),
        colorDark: "#000000",
        colorLight: "#ffffff",
        errorCorrectionLevel: this.errorCorrection.value,
        margin: parseInt(this.qrMargin.value, 10),
      };

      QRCode.toCanvas(this.qrCanvas, text, options, (error) => {
        if (error) {
          console.error(error);
          this.errorMessage.textContent = QR_TOO_LONG_ERROR_MESSAGE;
          this.qrCanvas.style.display = 'none';
        } else {
          this.qrCanvas.style.display = 'block';
          this.qrCanvas.setAttribute('role', 'img');
          this.qrCanvas.setAttribute('aria-label', getQrCanvasAriaLabel(text));
          this.errorMessage.textContent = '';
        }
      });
    }, 250);
  }

  bindEvents() {
    try {
      this.qrText.addEventListener('input', () => this.generateQRCode());
      this.qrText.addEventListener('textCleared', () => this.generateQRCode()); // Listen for clear event
      this.qrSize.addEventListener('input', () => {
        this.sizeLabel.textContent = `${this.qrSize.value}px`;
        this.generateQRCode();
      });
      this.qrMargin.addEventListener('input', () => {
        this.marginLabel.textContent = this.qrMargin.value;
        this.generateQRCode();
      });
      this.errorCorrection.addEventListener('change', () => this.generateQRCode());
      this.downloadBtn.addEventListener('click', () => this.downloadQRCode());
    } catch (error) {
      console.error("Error binding events:", error);
    }
  }

  downloadQRCode() {
    const dataUrl = this.qrCanvas.toDataURL('image/png');
    const filename = `qrcode-${Date.now()}.png`;
    this.downloadManager.downloadFile(dataUrl, filename, 'image/png');
  }

  initializeApp() {
    this.sizeLabel.textContent = `${this.qrSize.value}px`;
    this.marginLabel.textContent = this.qrMargin.value;
    this.generateQRCode();
  }
}

const DEFAULT_QR_STATE = {
  text: 'https://codesamplez.com',
  size: 256,
  margin: 2,
  errorCorrection: 'M'
};

function createQrCanvasOptions({ text, size, margin, errorCorrection }) {
  return {
    width: size,
    height: size,
    colorDark: '#000000',
    colorLight: '#ffffff',
    errorCorrectionLevel: errorCorrection,
    margin
  };
}

function getQrCanvasAriaLabel(text) {
  const labelText = text.length > 50 ? `${text.substring(0, 50)}...` : text;
  return `QR code for: ${labelText}`;
}

export function QRCodeGeneratorApp() {
  const [text, setText] = useState(DEFAULT_QR_STATE.text);
  const [size, setSize] = useState(DEFAULT_QR_STATE.size);
  const [margin, setMargin] = useState(DEFAULT_QR_STATE.margin);
  const [errorCorrection, setErrorCorrection] = useState(DEFAULT_QR_STATE.errorCorrection);
  const [errorMessage, setErrorMessage] = useState('');
  const [canvasVisible, setCanvasVisible] = useState(true);
  const [canvasAriaLabel, setCanvasAriaLabel] = useState('QR Code');
  const textAreaRef = useRef(null);
  const canvasRef = useRef(null);
  const debounceRef = useRef(null);
  const clearButtonRef = useRef(null);

  useEffect(() => {
    if (!(textAreaRef.current instanceof HTMLTextAreaElement)) {
      return undefined;
    }

    const textArea = textAreaRef.current;
    clearButtonRef.current = new ClearButton(textArea);

    const handleTextCleared = () => {
      setText(textArea.value);
    };

    textArea.addEventListener('textCleared', handleTextCleared);
    return () => {
      textArea.removeEventListener('textCleared', handleTextCleared);
      clearButtonRef.current?.disconnect?.();
    };
  }, []);

  useEffect(() => {
    clearButtonRef.current?.updateVisibility?.();
  }, [text]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      if (!text) {
        setCanvasVisible(false);
        setErrorMessage(QR_EMPTY_INPUT_MESSAGE);
        return;
      }

      setCanvasVisible(true);
      setErrorMessage('');

      const options = createQrCanvasOptions({ text, size, margin, errorCorrection });
      QRCode.toCanvas(canvas, text, options, (error) => {
        if (error) {
          console.error(error);
          setCanvasVisible(false);
          setErrorMessage(QR_TOO_LONG_ERROR_MESSAGE);
          return;
        }

        setCanvasVisible(true);
        setErrorMessage('');
        setCanvasAriaLabel(getQrCanvasAriaLabel(text));
      });
    }, 250);

    return () => {
      clearTimeout(debounceRef.current);
    };
  }, [text, size, margin, errorCorrection]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    const filename = `qrcode-${Date.now()}.png`;
    const downloadManager = new DownloadManager();
    downloadManager.downloadFile(dataUrl, filename, 'image/png');
  };

  return (
    <div id="qr-code-generator-tool" className="tool-container qr-tool">
      <main className="qr-tool__main-content">
        <div className="qr-tool__controls">
          <h3 className="qr-tool__section-title">Configuration</h3>

          <div className="qr-tool__form-group">
            <label htmlFor="qr-text" className="qr-tool__label">Text or URL</label>
            <textarea
              id="qr-text"
              ref={textAreaRef}
              rows="4"
              className="qr-tool__textarea c-input c-input--textarea"
              placeholder="e.g. https://codesamplez.com"
              value={text}
              onInput={(event) => setText(event.target.value)}
            />
          </div>

          <div className="qr-tool__form-group">
            <label htmlFor="qr-size" className="qr-tool__label">
              Size: <span id="size-label">{size}px</span>
            </label>
            <input
              id="qr-size"
              type="range"
              min="128"
              max="600"
              step="16"
              value={size}
              className="qr-tool__slider"
              onInput={(event) => setSize(Number(event.target.value))}
            />
          </div>

          <div className="qr-tool__form-group">
            <label htmlFor="qr-margin" className="qr-tool__label">
              Quiet Zone (Margin): <span id="margin-label">{margin}</span>
            </label>
            <input
              id="qr-margin"
              type="range"
              min="0"
              max="10"
              step="1"
              value={margin}
              className="qr-tool__slider"
              onInput={(event) => setMargin(Number(event.target.value))}
            />
          </div>

          <div className="qr-tool__form-group">
            <label htmlFor="error-correction" className="qr-tool__label">Error Correction</label>
            <select
              id="error-correction"
              className="qr-tool__select c-input"
              value={errorCorrection}
              onChange={(event) => setErrorCorrection(event.target.value)}
            >
              <option value="L">Low (L) - ~7%</option>
              <option value="M">Medium (M) - ~15%</option>
              <option value="Q">Quartile (Q) - ~25%</option>
              <option value="H">High (H) - ~30%</option>
            </select>
          </div>
        </div>

        <div className="qr-tool__preview">
          <div id="qr-code-container" className="qr-tool__qr-container">
            <canvas
              id="qr-canvas"
              ref={canvasRef}
              role="img"
              aria-label={canvasAriaLabel}
              style={{ display: canvasVisible ? 'block' : 'none' }}
            />
          </div>
          <button id="download-btn" className="qr-tool__button c-button" onClick={handleDownload}>
            <span className="c-button--icon-download">Download PNG</span>
          </button>
          <p id="error-message" className="qr-tool__error-message" role="alert" aria-live="assertive">
            {errorMessage}
          </p>
        </div>
      </main>

      <footer className="qr-tool__footer" />
    </div>
  );
}

export class QRCodeGeneratorToolUI {
  constructor(rootSelector = '#qr-code-generator-app') {
    const root = document.querySelector(rootSelector) || document.querySelector('#qr-code-generator-tool');
    if (!root) {
      throw new Error('QR Code Generator root element not found');
    }

    const mount = root.hasChildNodes() ? hydrate : render;
    mount(<QRCodeGeneratorApp />, root);
  }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', () => {
    mountToolShell({
      title: 'QR Code Generator',
      description: 'Create and customize your QR codes instantly.',
      homeHref: '/'
    });

    const qrCodeGenerator = new QRCodeGeneratorToolUI();
    if (typeof window !== 'undefined') {
      window.qrCodeGenerator = qrCodeGenerator;
    }
  });
}
