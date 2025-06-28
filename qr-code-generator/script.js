import QRCode from 'qrcode';

class QRCodeGeneratorUI {
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
        this.errorMessage.textContent = 'Please enter text or a URL to generate a QR code.';
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
          this.errorMessage.textContent = "Error: Input data is too long for the selected error correction level. Try reducing data or increasing error correction.";
          this.qrCanvas.style.display = 'none';
        } else {
          console.log('QR code successfully generated!');
          this.qrCanvas.style.display = 'block';
          this.errorMessage.textContent = "";
        }
      });
    }, 250);
  }

  bindEvents() {
    try {
      this.qrText.addEventListener('input', () => this.generateQRCode());
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
    const link = document.createElement('a');
    link.href = dataUrl;
    const filename = `qrcode-${Date.now()}.png`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  initializeApp() {
    this.sizeLabel.textContent = `${this.qrSize.value}px`;
    this.marginLabel.textContent = this.qrMargin.value;
    this.generateQRCode();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const qrCodeGenerator = new QRCodeGeneratorUI({
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
  window.qrCodeGenerator = qrCodeGenerator;
});
