import '@testing-library/jest-dom';
import { fireEvent } from '@testing-library/dom';

// Mock QRCode and DownloadManager before importing the script
jest.mock('qrcode', () => ({
  toCanvas: jest.fn((canvas, text, options, callback) => {
    callback(null); // Simulate successful QR code generation
  }),
}));

jest.mock('../common/DownloadManager', () => {
  return jest.fn().mockImplementation(() => {
    return {
      downloadFile: jest.fn(),
    };
  });
});

// Mock ClearButton
jest.mock('../common/clear-button/ClearButton', () => {
  return jest.fn().mockImplementation(() => {
    return {};
  });
});

import QRCode from 'qrcode';
import DownloadManager from '../common/DownloadManager';
import ClearButton from '../common/clear-button/ClearButton';
import { QRCodeGeneratorUI } from './script';

describe('QRCodeGeneratorUI', () => {
  let qrCodeGenerator;
  let mockDownloadManagerInstance;
  let qrText;
  let qrSize;
  let sizeLabel;
  let qrMargin;
  let marginLabel;
  let errorCorrection;
  let qrCanvas;
  let downloadBtn;
  let errorMessage;

  const defaultOptions = {
    qrTextId: 'qr-text',
    qrSizeId: 'qr-size',
    sizeLabelId: 'size-label',
    qrMarginId: 'qr-margin',
    marginLabelId: 'margin-label',
    errorCorrectionId: 'error-correction',
    qrCanvasId: 'qr-canvas',
    downloadBtnId: 'download-btn',
    errorMessageId: 'error-message',
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    document.body.innerHTML = `
      <div id="test-qr-container">
        <textarea id="qr-text">Initial Text</textarea>
        <input type="range" id="qr-size" min="128" max="600" value="256" />
        <span id="size-label"></span>
        <input type="range" id="qr-margin" min="0" max="10" value="4" />
        <span id="margin-label"></span>
        <select id="error-correction">
          <option value="L">Low (L)</option>
          <option value="M" selected>Medium (M)</option>
          <option value="Q">Quartile (Q)</option>
          <option value="H">High (H)</option>
        </select>
        <canvas id="qr-canvas"></canvas>
        <button id="download-btn">Download</button>
        <p id="error-message"></p>
      </div>
    `;

    qrText = document.getElementById('qr-text');
    qrSize = document.getElementById('qr-size');
    sizeLabel = document.getElementById('size-label');
    qrMargin = document.getElementById('qr-margin');
    marginLabel = document.getElementById('margin-label');
    errorCorrection = document.getElementById('error-correction');
    qrCanvas = document.getElementById('qr-canvas');
    downloadBtn = document.getElementById('download-btn');
    errorMessage = document.getElementById('error-message');

    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      configurable: true,
      value: jest.fn(() => 'data:image/png;base64,mockdata'),
    });

    mockDownloadManagerInstance = new DownloadManager();

    qrCodeGenerator = new QRCodeGeneratorUI(defaultOptions);
    qrCodeGenerator.downloadManager = mockDownloadManagerInstance;

    // Advance debounce timer triggered during initializeApp()
    jest.advanceTimersByTime(250);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('should initialize ClearButton', () => {
    expect(ClearButton).toHaveBeenCalledTimes(1);
    expect(ClearButton).toHaveBeenCalledWith(qrText);
  });

  it('should initialize with correct label text and generate QR code', () => {
    expect(sizeLabel.textContent).toBe('256px');
    expect(marginLabel.textContent).toBe('4');
    expect(QRCode.toCanvas).toHaveBeenCalledTimes(1);
    expect(QRCode.toCanvas).toHaveBeenCalledWith(
      qrCanvas,
      'Initial Text',
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('should generate QR code on text input', () => {
    QRCode.toCanvas.mockClear();

    qrText.value = 'test';
    fireEvent.input(qrText);
    jest.advanceTimersByTime(250);

    expect(qrCanvas.style.display).toBe('block');
    expect(QRCode.toCanvas).toHaveBeenCalledTimes(1);
    expect(QRCode.toCanvas).toHaveBeenCalledWith(
      qrCanvas,
      'test',
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('should generate QR code on textCleared event', () => {
    QRCode.toCanvas.mockClear();

    qrText.value = 'cleared';
    qrText.dispatchEvent(new CustomEvent('textCleared'));
    jest.advanceTimersByTime(250);

    expect(QRCode.toCanvas).toHaveBeenCalledTimes(1);
    expect(QRCode.toCanvas).toHaveBeenCalledWith(
      qrCanvas,
      'cleared',
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('should hide canvas and show error if text input is empty', () => {
    qrText.value = '';
    fireEvent.input(qrText);
    jest.advanceTimersByTime(250);

    expect(qrCanvas.style.display).toBe('none');
    expect(errorMessage.textContent).toBe('Please enter text or a URL to generate a QR code.');
  });

  it('should handle QR library errors and hide canvas', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    QRCode.toCanvas.mockImplementationOnce((canvas, text, options, callback) => {
      callback(new Error('QR generation failed'));
    });

    qrText.value = 'trigger error';
    fireEvent.input(qrText);
    jest.advanceTimersByTime(250);

    expect(qrCanvas.style.display).toBe('none');
    expect(errorMessage.textContent).toContain('Input data is too long');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('should update size label and regenerate QR code on size input', () => {
    QRCode.toCanvas.mockClear();

    qrSize.value = '300';
    fireEvent.input(qrSize);
    jest.advanceTimersByTime(250);

    expect(sizeLabel.textContent).toBe('300px');
    expect(QRCode.toCanvas).toHaveBeenCalledTimes(1);
    expect(QRCode.toCanvas).toHaveBeenCalledWith(
      qrCanvas,
      'Initial Text',
      expect.objectContaining({ width: 300, height: 300 }),
      expect.any(Function)
    );
  });

  it('should update margin label and regenerate QR code on margin input', () => {
    QRCode.toCanvas.mockClear();

    qrMargin.value = '10';
    fireEvent.input(qrMargin);
    jest.advanceTimersByTime(250);

    expect(marginLabel.textContent).toBe('10');
    expect(QRCode.toCanvas).toHaveBeenCalledTimes(1);
    expect(QRCode.toCanvas).toHaveBeenCalledWith(
      qrCanvas,
      'Initial Text',
      expect.objectContaining({ margin: 10 }),
      expect.any(Function)
    );
  });

  it('should regenerate QR code on error correction change', () => {
    QRCode.toCanvas.mockClear();

    errorCorrection.value = 'H';
    fireEvent.change(errorCorrection);
    jest.advanceTimersByTime(250);

    expect(QRCode.toCanvas).toHaveBeenCalledTimes(1);
    expect(QRCode.toCanvas).toHaveBeenCalledWith(
      qrCanvas,
      'Initial Text',
      expect.objectContaining({ errorCorrectionLevel: 'H' }),
      expect.any(Function)
    );
  });

  it('should call downloadManager.downloadFile when download button is clicked', () => {
    mockDownloadManagerInstance.downloadFile.mockClear();

    fireEvent.click(downloadBtn);

    expect(mockDownloadManagerInstance.downloadFile).toHaveBeenCalledTimes(1);
    expect(mockDownloadManagerInstance.downloadFile).toHaveBeenCalledWith(
      'data:image/png;base64,mockdata',
      expect.stringMatching(/^qrcode-\d+\.png$/),
      'image/png'
    );
  });

  it('should update aria-label on canvas when QR code is generated', () => {
    QRCode.toCanvas.mockClear();

    const testText = 'Accessible QR Code Test';
    qrText.value = testText;
    fireEvent.input(qrText);
    jest.advanceTimersByTime(250);

    expect(qrCanvas.getAttribute('aria-label')).toBe(`QR code for: ${testText}`);
    expect(qrCanvas.getAttribute('role')).toBe('img');
  });

  it('should truncate aria-label on canvas when text is too long', () => {
    QRCode.toCanvas.mockClear();

    const longText = 'This is a very long text that should be truncated for the aria-label to ensure accessibility';
    qrText.value = longText;
    fireEvent.input(qrText);
    jest.advanceTimersByTime(250);

    const expectedTruncatedText = longText.substring(0, 50) + '...';
    expect(qrCanvas.getAttribute('aria-label')).toBe(`QR code for: ${expectedTruncatedText}`);
  });

  it('should return early from generateQRCode when required elements are missing', () => {
    QRCode.toCanvas.mockClear();
    document.getElementById('error-message')?.remove();

    const partialGenerator = new QRCodeGeneratorUI(defaultOptions);
    partialGenerator.generateQRCode();

    expect(QRCode.toCanvas).not.toHaveBeenCalled();
  });

  it('should return early from bindEvents when required controls are missing', () => {
    document.getElementById('download-btn')?.remove();

    const partialGenerator = new QRCodeGeneratorUI(defaultOptions);
    expect(partialGenerator.downloadBtn).toBeNull();
  });

  it('should return early from downloadQRCode when canvas is missing', () => {
    document.getElementById('qr-canvas')?.remove();

    const partialGenerator = new QRCodeGeneratorUI(defaultOptions);
    partialGenerator.downloadManager = mockDownloadManagerInstance;
    mockDownloadManagerInstance.downloadFile.mockClear();

    partialGenerator.downloadQRCode();
    expect(mockDownloadManagerInstance.downloadFile).not.toHaveBeenCalled();
  });

  it('should return early from initializeApp when label or range inputs are missing', () => {
    QRCode.toCanvas.mockClear();
    document.getElementById('size-label')?.remove();

    const partialGenerator = new QRCodeGeneratorUI(defaultOptions);
    partialGenerator.initializeApp();

    expect(QRCode.toCanvas).not.toHaveBeenCalled();
  });

  it('should catch and log error if event binding throws', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const faultyBtn = document.getElementById('download-btn');
    jest.spyOn(faultyBtn, 'addEventListener').mockImplementationOnce(() => {
      throw new Error('Event listener error');
    });

    new QRCodeGeneratorUI(defaultOptions);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error binding events:', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });
});
