import QRCode from 'qrcode';

describe('qrcode canvas renderer options', () => {
    it('uses the configured width and color.dark/color.light values', () => {
        const canvas = document.createElement('canvas');
        const context = {
            clearRect: jest.fn(),
            createImageData: jest.fn((width, height) => ({
                data: new Uint8ClampedArray(width * height * 4)
            })),
            putImageData: jest.fn()
        };
        const getContext = jest.spyOn(canvas, 'getContext').mockReturnValue(context);
        const callback = jest.fn();

        QRCode.toCanvas(canvas, 'renderer options integration', {
            width: 256,
            color: { dark: '#ff0000ff', light: '#00ff00ff' },
            errorCorrectionLevel: 'M',
            margin: 2
        }, callback);

        expect(callback).toHaveBeenCalledWith(null, canvas);
        expect(getContext).toHaveBeenCalledWith('2d');
        expect(canvas.width).toBe(256);

        const { data } = context.putImageData.mock.calls[0][0];
        const pixelColors = new Set();
        for (let index = 0; index < data.length; index += 4) {
            pixelColors.add(`${data[index]},${data[index + 1]},${data[index + 2]},${data[index + 3]}`);
        }

        expect(pixelColors.has('255,0,0,255')).toBe(true);
        expect(pixelColors.has('0,255,0,255')).toBe(true);
    });
});
