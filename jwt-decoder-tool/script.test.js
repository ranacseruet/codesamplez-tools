import { clearAll, decodeJWT, copyDecoded } from './script.js';

beforeEach(() => {
  document.body.innerHTML = `
    <textarea id="jwtInputToken"></textarea>
    <textarea id="jwtSecretKey"></textarea>
    <textarea id="jwtDecodedOutput"></textarea>
    <div id="headerJson"></div>
    <div id="payloadJson"></div>
    <div id="rawJsonViewer"></div>
    <div id="jwtSignatureStatus"></div>
    <button id="jwt-decoder-copy-btn"></button>
  `;

  Object.assign(navigator, {
    clipboard: {
      writeText: jest.fn()
    }
  });
});

describe('JWT Decoder UI Functions', () => {
  describe('clearAll', () => {
    it('should clear all input and output fields', () => {
      document.getElementById('jwtInputToken').value = 'test';
      document.getElementById('jwtSecretKey').value = 'secret';
      document.getElementById('jwtDecodedOutput').value = 'output';
      document.getElementById('headerJson').innerHTML = '<div>header</div>';
      document.getElementById('payloadJson').innerHTML = '<div>payload</div>';
      document.getElementById('rawJsonViewer').innerHTML = '<div>raw</div>';
      document.getElementById('jwtSignatureStatus').textContent = 'Verified';
      document.getElementById('jwtSignatureStatus').style.color = 'green';

      clearAll();

      expect(document.getElementById('jwtInputToken').value).toBe('');
      expect(document.getElementById('jwtSecretKey').value).toBe('');
      expect(document.getElementById('jwtDecodedOutput').value).toBe('');
      expect(document.getElementById('headerJson').innerHTML).toBe('');
      expect(document.getElementById('payloadJson').innerHTML).toBe('');
      expect(document.getElementById('rawJsonViewer').innerHTML).toBe('');
      expect(document.getElementById('jwtSignatureStatus').textContent).toBe('Not verified');
      expect(document.getElementById('jwtSignatureStatus').style.color).toBe('rgb(102, 102, 102)');
    });
  });

  describe('decodeJWT', () => {
    it('should handle empty token', async () => {
      await decodeJWT();
      expect(document.getElementById('jwtDecodedOutput').value).toBe('');
    });
  });

  describe('copyDecoded', () => {
    it('should copy decoded content to clipboard', async () => {
      document.getElementById('jwtDecodedOutput').value = 'test content';
      await copyDecoded();
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test content');
    });

    it('should handle empty content', async () => {
      await copyDecoded();
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });
  });
});
