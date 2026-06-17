import QRCode from 'qrcode';
import DownloadManager from '../common/DownloadManager';
import ClearButton from '../common/clear-button/ClearButton';
import { hydrate, render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { QRCodeGeneratorArticle, QRCodeGeneratorIntro } from './content';
import toolMetadata from './tool.meta.json';

const QR_EMPTY_INPUT_MESSAGE = 'Please enter text or a URL to generate a QR code.';
const QR_TOO_LONG_ERROR_MESSAGE = 'Error: Input data is too long for the selected error correction level. Try reducing data or increasing error correction.';

type QrGeneratorDomOptions = {
  qrTextId: string;
  qrSizeId: string;
  sizeLabelId: string;
  qrMarginId: string;
  marginLabelId: string;
  errorCorrectionId: string;
  qrCanvasId: string;
  downloadBtnId: string;
  errorMessageId: string;
};

export class QRCodeGeneratorUI {
  qrText: HTMLTextAreaElement | null = null;
  qrSize: HTMLInputElement | null = null;
  sizeLabel: HTMLElement | null = null;
  qrMargin: HTMLInputElement | null = null;
  marginLabel: HTMLElement | null = null;
  errorCorrection: HTMLSelectElement | null = null;
  qrCanvas: HTMLCanvasElement | null = null;
  downloadBtn: HTMLElement | null = null;
  errorMessage: HTMLElement | null = null;
  downloadManager!: DownloadManager;
  clearButton: ClearButton | null = null;
  debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: QrGeneratorDomOptions) {
    this.qrText = document.getElementById(options.qrTextId) as HTMLTextAreaElement | null;
    this.qrSize = document.getElementById(options.qrSizeId) as HTMLInputElement | null;
    this.sizeLabel = document.getElementById(options.sizeLabelId);
    this.qrMargin = document.getElementById(options.qrMarginId) as HTMLInputElement | null;
    this.marginLabel = document.getElementById(options.marginLabelId);
    this.errorCorrection = document.getElementById(options.errorCorrectionId) as HTMLSelectElement | null;
    this.qrCanvas = document.getElementById(options.qrCanvasId) as HTMLCanvasElement | null;
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
    if (!this.qrText || !this.qrSize || !this.errorCorrection || !this.qrMargin || !this.qrCanvas || !this.errorMessage) {
      return;
    }

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
    if (!this.qrText || !this.qrSize || !this.sizeLabel || !this.qrMargin || !this.marginLabel || !this.errorCorrection || !this.downloadBtn) {
      return;
    }

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
    if (!this.qrCanvas) {
      return;
    }

    const dataUrl = this.qrCanvas.toDataURL('image/png');
    const filename = `qrcode-${Date.now()}.png`;
    this.downloadManager.downloadFile(dataUrl, filename, 'image/png');
  }

  initializeApp() {
    if (!this.sizeLabel || !this.qrSize || !this.marginLabel || !this.qrMargin) {
      return;
    }

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

function getQrCanvasAriaLabel(text: string) {
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
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearButtonRef = useRef<ClearButton | null>(null);

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

  const handleTextInput = (event) => {
    const target = event.target;
    setText(target instanceof HTMLTextAreaElement ? target.value : '');
  };

  const handleSizeInput = (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      setSize(Number(target.value));
    }
  };

  const handleMarginInput = (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      setMargin(Number(target.value));
    }
  };

  const handleErrorCorrectionChange = (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement) {
      setErrorCorrection(target.value);
    }
  };

  return (
    <div id="qr-code-generator-tool" className="tool-container qr-tool c-tool-stack">
      <div className="qr-tool__main-content">
        <div className="qr-tool__controls c-surface-card">
          <h3 className="qr-tool__section-title">Configuration</h3>

          <div className="qr-tool__form-group">
            <label htmlFor="qr-text" className="qr-tool__label">Text or URL</label>
            <textarea
              id="qr-text"
              ref={textAreaRef}
              rows={4}
              className="qr-tool__textarea c-input c-input--textarea"
              placeholder="e.g. https://codesamplez.com"
              value={text}
              onInput={handleTextInput}
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
              onInput={handleSizeInput}
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
              onInput={handleMarginInput}
            />
          </div>

          <div className="qr-tool__form-group">
            <label htmlFor="error-correction" className="qr-tool__label">Error Correction</label>
            <select
              id="error-correction"
              className="qr-tool__select c-input"
              value={errorCorrection}
              onChange={handleErrorCorrectionChange}
            >
              <option value="L">Low (L) - ~7%</option>
              <option value="M">Medium (M) - ~15%</option>
              <option value="Q">Quartile (Q) - ~25%</option>
              <option value="H">High (H) - ~30%</option>
            </select>
          </div>
        </div>

        <div className="qr-tool__preview c-surface-card">
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
      </div>

      {/* Tool-first ordering: About intro + guide below the interactive tool. */}
      <QRCodeGeneratorIntro />
      <QRCodeGeneratorArticle />

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
      title: toolMetadata.title,
      description: toolMetadata.description,
      homeHref: '/'
    });

    const qrCodeGenerator = new QRCodeGeneratorToolUI();
    if (typeof window !== 'undefined') {
      const browserWindow = window as Window & { qrCodeGenerator?: QRCodeGeneratorToolUI };
      browserWindow.qrCodeGenerator = qrCodeGenerator;
    }
  });
}
