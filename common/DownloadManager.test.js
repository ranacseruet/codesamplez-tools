import DownloadManager from './DownloadManager';

describe('DownloadManager', () => {
  let downloadManager;
  let createElementSpy;
  let appendChildSpy;
  let removeChildSpy;
  let clickSpy;
  let revokeObjectURLSpy;

  beforeEach(() => {
    downloadManager = new DownloadManager();

    // Mock document methods
    createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(() => {
      return {
        href: '',
        download: '',
        click: jest.fn(),
      };
    });

    appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => {});
    clickSpy = jest.fn();

    // Mock URL
    revokeObjectURLSpy = jest.fn();
    global.URL.createObjectURL = jest.fn(() => 'mock-url');
    global.URL.revokeObjectURL = revokeObjectURLSpy;

    // Mock setTimeout to execute immediately
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('should create a blob and trigger download', () => {
    const content = 'test content';
    const filename = 'test.txt';
    const mimeType = 'text/plain';

    downloadManager.downloadFile(content, filename, mimeType);

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();

    // Advance timers to check cleanup
    jest.advanceTimersByTime(10000);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('mock-url');
  });
});
