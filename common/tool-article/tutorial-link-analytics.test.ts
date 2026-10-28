import { clearMountedToolAnalyticsId, setMountedToolAnalyticsId } from '../analytics-tool-context';
import { TUTORIAL_LINK_CLASS, TUTORIAL_LINK_PATH_ATTR } from './tutorial-links';
import {
    TUTORIAL_LINK_CLICK_EVENT,
    registerTutorialLinkClickAnalytics,
    resetTutorialLinkClickAnalyticsForTests,
    trackTutorialLinkClick
} from './tutorial-link-analytics';

type GtagMock = jest.Mock;

function installGtag(): GtagMock {
    const gtag = jest.fn();
    (window as unknown as { gtag?: GtagMock }).gtag = gtag;
    return gtag;
}

describe('tutorial link click analytics', () => {
    beforeEach(() => {
        resetTutorialLinkClickAnalyticsForTests();
        clearMountedToolAnalyticsId();
        delete (window as unknown as { gtag?: GtagMock }).gtag;
        document.body.innerHTML = `
            <a class="${TUTORIAL_LINK_CLASS}" href="https://codesamplez.com/development/json-web-token-crash-course" ${TUTORIAL_LINK_PATH_ATTR}="/development/json-web-token-crash-course">JSON Web Token crash course</a>
            <a class="c-tool-article__content" href="https://example.com/secret">Other</a>
        `;
    });

    afterEach(() => {
        resetTutorialLinkClickAnalyticsForTests();
        clearMountedToolAnalyticsId();
        delete (window as unknown as { gtag?: GtagMock }).gtag;
    });

    it('emits tutorial_link_click with the tool id and tutorial path only', () => {
        const gtag = installGtag();
        setMountedToolAnalyticsId('jwt-decoder');
        registerTutorialLinkClickAnalytics();

        document.querySelector(`.${TUTORIAL_LINK_CLASS}`)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(gtag).toHaveBeenCalledTimes(1);
        expect(gtag).toHaveBeenCalledWith('event', TUTORIAL_LINK_CLICK_EVENT, {
            tool_id: 'jwt-decoder',
            target_path: '/development/json-web-token-crash-course'
        });
        expect(JSON.stringify(gtag.mock.calls)).not.toContain('codesamplez.com');
    });

    it('ignores clicks that are not tutorial links', () => {
        const gtag = installGtag();
        setMountedToolAnalyticsId('jwt-decoder');
        registerTutorialLinkClickAnalytics();

        document.querySelector('a[href="https://example.com/secret"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(gtag).not.toHaveBeenCalled();
    });

    it('drops paths that are not in the shared map, including full URLs and tool input', () => {
        const gtag = installGtag();
        setMountedToolAnalyticsId('diff-checker');
        const secret = 'user pasted this token';

        trackTutorialLinkClick('/development/json-web-token-crash-course/');
        trackTutorialLinkClick('https://codesamplez.com/development/jwt-best-practices');
        trackTutorialLinkClick(`/programming/base64-explained?q=${secret}`);
        trackTutorialLinkClick(secret);

        expect(gtag).not.toHaveBeenCalled();
        expect(JSON.stringify(gtag.mock.calls)).not.toContain(secret);
    });

    it('is a no-op when gtag or the tool id is missing', () => {
        expect(() => trackTutorialLinkClick('/programming/base64-explained')).not.toThrow();

        const gtag = installGtag();
        trackTutorialLinkClick('/programming/base64-explained');
        expect(gtag).not.toHaveBeenCalled();
    });
});
