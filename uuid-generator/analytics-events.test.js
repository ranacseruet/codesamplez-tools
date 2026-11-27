import { jest } from '@jest/globals';
import { fireEvent, waitFor } from '@testing-library/dom';
import { clearToolUsedDedupe } from '../common/analytics-events';

jest.mock('../common/notification-manager', () => ({
    NotificationManager: { show: jest.fn() }
}));

jest.mock('../common/app-shell/mountToolShell', () => ({
    mountToolShell: jest.fn()
}));

jest.mock('../common/clear-button/ClearButton', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        updateVisibility: jest.fn(),
        disconnect: jest.fn()
    }))
}));

jest.mock('../common/copy-button/CopyButton', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        updateVisibility: jest.fn(),
        disconnect: jest.fn()
    }))
}));

jest.mock('../common/DownloadManager', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        downloadFile: jest.fn()
    }))
}));

import { UuidGeneratorToolUI } from './script';

const SECRET = '123e4567-89ab-4cde-8f01-23456789abcd';

function installGtag() {
    const gtag = jest.fn();
    window.gtag = gtag;
    return gtag;
}

function toolUsedCalls(gtag) {
    return gtag.mock.calls.filter((call) => call[0] === 'event' && call[1] === 'tool_used');
}

const flushEffects = () => new Promise((resolve) => {
    setTimeout(resolve, 50);
});

describe('UUID Generator tool_used', () => {
    beforeEach(() => {
        clearToolUsedDedupe();
        delete window.gtag;
        document.body.innerHTML = '<div id="uuid-generator-app"></div>';
        jest.spyOn(crypto, 'randomUUID').mockReturnValue(SECRET);
        new UuidGeneratorToolUI();
    });

    afterEach(() => {
        clearToolUsedDedupe();
        delete window.gtag;
        jest.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('fires one generate-v4 event and omits the UUID', async () => {
        const gtag = installGtag();
        fireEvent.click(document.getElementById('uuid-generate'));

        await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
        expect(document.querySelector('.uuidg-line code').textContent).toBe(SECRET);
        expect(toolUsedCalls(gtag)[0][2]).toEqual({
            tool_id: 'uuid-generator',
            action: 'generate-v4',
            trigger: 'user',
            outcome: 'success',
            input_size_bucket: '<1KB'
        });
        expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain(SECRET);
        expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('123e4567');
    });

    it('tags a bad count as generate-v7 error and omits the field text', async () => {
        const gtag = installGtag();
        fireEvent.click(document.getElementById('uuid-version-v7'));
        fireEvent.input(document.getElementById('uuid-count'), { target: { value: 'nope-UNIQUE-94' } });
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-generate'));

        await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
        expect(toolUsedCalls(gtag)[0][2]).toEqual({
            tool_id: 'uuid-generator',
            action: 'generate-v7',
            trigger: 'user',
            outcome: 'error',
            input_size_bucket: '<1KB'
        });
        expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('nope-UNIQUE-94');
    });

    it('does not fire when the validator is empty', async () => {
        const gtag = installGtag();
        fireEvent.click(document.getElementById('uuid-validate'));
        await Promise.resolve();
        expect(toolUsedCalls(gtag)).toHaveLength(0);
    });

    it('tags an invalid paste as validate error and omits the text', async () => {
        const gtag = installGtag();
        const invalid = 'not-a-uuid-UNIQUE-94';
        fireEvent.input(document.getElementById('uuid-validate-input'), { target: { value: invalid } });
        await flushEffects();
        fireEvent.click(document.getElementById('uuid-validate'));

        await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
        expect(toolUsedCalls(gtag)[0][2].action).toBe('validate');
        expect(toolUsedCalls(gtag)[0][2].outcome).toBe('error');
        expect(toolUsedCalls(gtag)[0][2].trigger).toBe('user');
        expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain(invalid);
    });

    it('tags Load Sample as sample and omits both worked UUIDs', async () => {
        const gtag = installGtag();
        fireEvent.click(document.getElementById('uuid-load-sample'));

        await waitFor(() => expect(toolUsedCalls(gtag)).toHaveLength(1));
        expect(toolUsedCalls(gtag)[0][2]).toEqual(expect.objectContaining({
            tool_id: 'uuid-generator',
            action: 'validate',
            trigger: 'sample',
            outcome: 'success'
        }));
        expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain('01a20e25');
        expect(JSON.stringify(toolUsedCalls(gtag))).not.toContain(SECRET);
    });
});
