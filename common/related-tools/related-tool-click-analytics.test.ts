import { clearMountedToolAnalyticsId, setMountedToolAnalyticsId } from '../analytics-tool-context';
import {
    RELATED_TOOL_TARGET_ATTR,
    registerRelatedToolClickAnalytics,
    resetRelatedToolClickAnalyticsForTests
} from './related-tool-click-analytics';

type GtagMock = jest.Mock;

function installGtag(): GtagMock {
    const gtag = jest.fn();
    (window as unknown as { gtag?: GtagMock }).gtag = gtag;
    return gtag;
}

describe('registerRelatedToolClickAnalytics', () => {
    beforeEach(() => {
        resetRelatedToolClickAnalyticsForTests();
        clearMountedToolAnalyticsId();
        delete (window as unknown as { gtag?: GtagMock }).gtag;
        document.body.innerHTML = `
            <a class="c-related-tools__link" href="/json-formatter/" ${RELATED_TOOL_TARGET_ATTR}="json-formatter">JSON Formatter</a>
        `;
    });

    afterEach(() => {
        resetRelatedToolClickAnalyticsForTests();
        clearMountedToolAnalyticsId();
        delete (window as unknown as { gtag?: GtagMock }).gtag;
    });

    it('emits related_tool_click with source and target tool slugs', () => {
        const gtag = installGtag();
        setMountedToolAnalyticsId('diff-checker');
        registerRelatedToolClickAnalytics();

        const link = document.querySelector('.c-related-tools__link');
        link?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(gtag).toHaveBeenCalledWith('event', 'related_tool_click', {
            tool_id: 'diff-checker',
            target_tool_id: 'json-formatter'
        });
    });
});
