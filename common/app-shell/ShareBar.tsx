import type { JSX } from 'preact';
import { useState } from 'preact/hooks';

// Floating share rail shown on individual tool pages (mirrors the main site's
// article share widget, themed with the v2 iris tokens). Brand glyphs aren't in
// Lucide, so they're inlined as simple-icons-style `fill` paths; the copy/check
// icons reuse the shell's Lucide-geometry `stroke` convention. All icons use the
// shared `cst-icon` sizing class and `currentColor` so light/dark recolor for free.

export interface ShareBarProps {
    shareUrl: string;
    shareTitle: string;
}

const COPIED_RESET_MS = 2000;

function XIcon(): JSX.Element {
    return (
        <svg className="cst-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
        </svg>
    );
}

function FacebookIcon(): JSX.Element {
    return (
        <svg className="cst-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z" />
        </svg>
    );
}

function LinkedInIcon(): JSX.Element {
    return (
        <svg className="cst-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
    );
}

function RedditIcon(): JSX.Element {
    return (
        <svg className="cst-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M24 11.779c0-1.459-1.192-2.645-2.657-2.645-.715 0-1.363.286-1.84.746-1.81-1.191-4.259-1.949-6.971-2.046l1.483-4.669 4.016.941-.006.058c0 1.193.975 2.163 2.174 2.163 1.198 0 2.172-.97 2.172-2.163s-.975-2.164-2.172-2.164c-.92 0-1.704.574-2.021 1.379l-4.329-1.015c-.189-.046-.381.063-.44.249l-1.654 5.207c-2.762.052-5.258.814-7.103 2.023-.477-.461-1.125-.747-1.84-.747-1.466 0-2.658 1.186-2.658 2.645 0 1.06.627 1.969 1.529 2.391-.04.207-.06.42-.06.633 0 3.244 3.773 5.878 8.41 5.878 4.639 0 8.412-2.634 8.412-5.878 0-.214-.021-.428-.061-.637.896-.424 1.522-1.33 1.522-2.387zM6.776 13.595c0-.831.683-1.508 1.521-1.508.837 0 1.519.677 1.519 1.508 0 .832-.682 1.508-1.519 1.508-.838 0-1.521-.676-1.521-1.508zm8.07 4.973c-.838.83-2.165 1.234-4.057 1.234l-.014-.002-.013.002c-1.892 0-3.219-.404-4.057-1.234-.153-.151-.153-.396 0-.547.152-.151.4-.151.552 0 .677.671 1.792.998 3.505.998l.013.002.013-.002c1.713 0 2.828-.327 3.506-.998.152-.151.399-.151.552 0 .153.151.153.396 0 .547zm-.515-3.465c-.838 0-1.52-.676-1.52-1.508 0-.831.682-1.508 1.52-1.508.837 0 1.52.677 1.52 1.508 0 .832-.683 1.508-1.52 1.508z" />
        </svg>
    );
}

function LinkIcon(): JSX.Element {
    return (
        <svg
            className="cst-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
    );
}

function CheckIcon(): JSX.Element {
    return (
        <svg
            className="cst-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

interface ShareTarget {
    key: string;
    label: string;
    href: string;
    icon: JSX.Element;
}

function buildShareTargets(shareUrl: string, shareTitle: string): ShareTarget[] {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(shareTitle);

    return [
        {
            key: 'x',
            label: 'Share on X',
            href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
            icon: <XIcon />
        },
        {
            key: 'linkedin',
            label: 'Share on LinkedIn',
            href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
            icon: <LinkedInIcon />
        },
        {
            key: 'reddit',
            label: 'Share on Reddit',
            href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
            icon: <RedditIcon />
        },
        {
            key: 'facebook',
            label: 'Share on Facebook',
            href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
            icon: <FacebookIcon />
        }
    ];
}

export function ShareBar({ shareUrl, shareTitle }: ShareBarProps): JSX.Element {
    const [copied, setCopied] = useState(false);
    const shareTargets = buildShareTargets(shareUrl, shareTitle);
    const copyLabel = copied ? 'Link copied' : 'Copy link';

    function handleCopy(): void {
        const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
        if (!clipboard?.writeText) {
            return;
        }

        clipboard
            .writeText(shareUrl)
            .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
            })
            .catch(() => {
                // Clipboard can reject (permissions / insecure context) — fail quietly.
            });
    }

    return (
        <nav className="cst-share" aria-label="Share this tool">
            {shareTargets.map((target) => (
                <a
                    key={target.key}
                    className="cst-share__btn"
                    href={target.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={target.label}
                    title={target.label}
                >
                    <span className="cst-share__icon">{target.icon}</span>
                </a>
            ))}
            <button
                type="button"
                className={`cst-share__btn cst-share__btn--copy${copied ? ' is-copied' : ''}`}
                onClick={handleCopy}
                aria-label={copyLabel}
                title={copyLabel}
            >
                <span className="cst-share__icon">{copied ? <CheckIcon /> : <LinkIcon />}</span>
            </button>
        </nav>
    );
}
