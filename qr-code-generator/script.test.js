import '@testing-library/jest-dom';
import { JSDOM } from 'jsdom';
import path from 'path';
import fs from 'fs';
import { screen, fireEvent } from '@testing-library/dom';

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

import QRCode from 'qrcode';
import DownloadManager from '../common/DownloadManager';
import { QRCodeGeneratorUI } from './script';

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

let qrCodeGenerator;
let mockDownloadManagerInstance;

describe('QRCodeGeneratorUI', () => {
  let mockQrText;
  let mockQrSize;
  let mockSizeLabel;
  let mockQrMargin;
  let mockMarginLabel;
  let mockErrorCorrection;
  let mockQrCanvas;
  let mockDownloadBtn;
  let mockErrorMessage;

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Manually create mock DOM elements
    mockQrText = { value: 'Initial Text', addEventListener: jest.fn(), focus: jest.fn() };
    mockQrSize = { value: '256', addEventListener: jest.fn() };
    mockSizeLabel = { textContent: '', addEventListener: jest.fn() };
    mockQrMargin = { value: '4', addEventListener: jest.fn() };
    mockMarginLabel = { textContent: '', addEventListener: jest.fn() };
    mockErrorCorrection = { value: 'M', addEventListener: jest.fn() };
    mockQrCanvas = { style: { display: '' }, toDataURL: jest.fn(() => 'data:image/png;base64,mockdata'), addEventListener: jest.fn(), setAttribute: jest.fn() };
    mockDownloadBtn = { addEventListener: jest.fn() };
    mockErrorMessage = { textContent: '' };

    // Mock document.getElementById to return our mock elements
    jest.spyOn(document, 'getElementById').mockImplementation((id) => {
      switch (id) {
        case 'qr-text': return mockQrText;
        case 'qr-size': return mockQrSize;
        case 'size-label': return mockSizeLabel;
        case 'qr-margin': return mockQrMargin;
        case 'margin-label': return mockMarginLabel;
        case 'error-correction': return mockErrorCorrection;
        case 'qr-canvas': return mockQrCanvas;
        case 'download-btn': return mockDownloadBtn;
        case 'error-message': return mockErrorMessage;
        default: return null;
      }
    });

    // Instantiate DownloadManager mock
    mockDownloadManagerInstance = new DownloadManager();

    // Manually initialize QRCodeGeneratorUI with mock elements
    qrCodeGenerator = new QRCodeGeneratorUI({
      qrTextId: 'qr-text',
      qrSizeId: 'qr-size',
      sizeLabelId: 'size-label',
      qrMarginId: 'qr-margin',
      marginLabelId: 'margin-label',
      errorCorrectionId: 'error-correction',
      qrCanvasId: 'qr-canvas',
      downloadBtnId: 'download-btn',
      errorMessageId: 'error-message',
    });

    // Inject the mocked DownloadManager instance
    qrCodeGenerator.downloadManager = mockDownloadManagerInstance;

    // Ensure initial state is set up by calling initializeApp
    qrCodeGenerator.initializeApp();

    // Wait for the initial QR code generation debounce to complete
    await new Promise(resolve => setTimeout(resolve, 300));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize with correct label text and generate QR code', () => {
    expect(mockSizeLabel.textContent).toBe('256px');
    expect(mockMarginLabel.textContent).toBe('4');
    // QRCode.toCanvas should have been called once during initializeApp (after debounce)
    expect(QRCode.toCanvas).toHaveBeenCalledTimes(1);
    expect(QRCode.toCanvas).toHaveBeenCalledWith(
      mockQrCanvas,
      mockQrText.value,
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('should generate QR code on text input', async () => {
    QRCode.toCanvas.mockClear(); // Clear the call from initial setup

    mockQrText.value = 'test';
    // Simulate input event by calling the registered listener directly
    const inputListener = mockQrText.addEventListener.mock.calls.find(call => call[0] === 'input')[1];
    inputListener();

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(mockQrCanvas.style.display).toBe('block');
    expect(QRCode.toCanvas).toHaveBeenCalledTimes(1); // Now expecting only one call from this action
    expect(QRCode.toCanvas).toHaveBeenCalledWith(
      mockQrCanvas,
      'test',
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('should hide canvas and show error if text input is empty', async () => {
    mockQrText.value = '';
    const inputListener = mockQrText.addEventListener.mock.calls.find(call => call[0] === 'input')[1];
    inputListener();

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(mockQrCanvas.style.display).toBe('none');
    expect(mockErrorMessage.textContent).toBe('Please enter text or a URL to generate a QR code.');
  });

  it('should update size label and regenerate QR code on size input', async () => {
    QRCode.toCanvas.mockClear(); // Clear initial call

    mockQrSize.value = '300';
    const sizeListener = mockQrSize.addEventListener.mock.calls.find(call => call[0] === 'input')[1];
    sizeListener();

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(mockSizeLabel.textContent).toBe('300px');
    expect(QRCode.toCanvas).toHaveBeenCalledTimes(1);
    expect(QRCode.toCanvas).toHaveBeenCalledWith(
      mockQrCanvas,
      mockQrText.value,
      expect.objectContaining({ width: 300, height: 300 }),
      expect.any(Function)
    );
  });

  it('should update margin label and regenerate QR code on margin input', async () => {
    QRCode.toCanvas.mockClear(); // Clear initial call

    mockQrMargin.value = '10';
    const marginListener = mockQrMargin.addEventListener.mock.calls.find(call => call[0] === 'input')[1];
    marginListener();

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(mockMarginLabel.textContent).toBe('10');
    expect(QRCode.toCanvas).toHaveBeenCalledTimes(1);
    expect(QRCode.toCanvas).toHaveBeenCalledWith(
      mockQrCanvas,
      mockQrText.value,
      expect.objectContaining({ margin: 10 }),
      expect.any(Function)
    );
  });

  it('should regenerate QR code on error correction change', async () => {
    QRCode.toCanvas.mockClear(); // Clear initial call

    mockErrorCorrection.value = 'H';
    const changeListener = mockErrorCorrection.addEventListener.mock.calls.find(call => call[0] === 'change')[1];
    changeListener();

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 300));
    
    expect(QRCode.toCanvas).toHaveBeenCalledTimes(1);
    expect(QRCode.toCanvas).toHaveBeenCalledWith(
      mockQrCanvas,
      mockQrText.value,
      expect.objectContaining({ errorCorrectionLevel: 'H' }),
      expect.any(Function)
    );
  });

  it('should call downloadManager.downloadFile when download button is clicked', async () => {
    // Ensure QR code is generated first
    mockQrText.value = 'test';
    const inputListener = mockQrText.addEventListener.mock.calls.find(call => call[0] === 'input')[1];
    inputListener();
    await new Promise(resolve => setTimeout(resolve, 300));
    
    mockDownloadManagerInstance.downloadFile.mockClear(); // Clear any calls from initial generation

    const clickListener = mockDownloadBtn.addEventListener.mock.calls.find(call => call[0] === 'click')[1];
    clickListener();

    expect(mockDownloadManagerInstance.downloadFile).toHaveBeenCalledTimes(1);
    expect(mockDownloadManagerInstance.downloadFile).toHaveBeenCalledWith(
      'data:image/png;base64,mockdata',
      expect.stringMatching(/^qrcode-\d+\.png$/),
      'image/png'
    );
  });

  it('should set accessible attributes on canvas when QR code is generated', async () => {
    QRCode.toCanvas.mockClear();

    mockQrText.value = 'Accessible QR Code';
    const inputListener = mockQrText.addEventListener.mock.calls.find(call => call[0] === 'input')[1];
    inputListener();

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(mockQrCanvas.setAttribute).toHaveBeenCalledWith('role', 'img');
    expect(mockQrCanvas.setAttribute).toHaveBeenCalledWith('aria-label', 'QR Code for Accessible QR Code');
  });
});
