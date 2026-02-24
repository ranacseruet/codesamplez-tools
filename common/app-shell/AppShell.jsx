export function ToolShellHeader({
    title,
    description,
    homeHref = '/',
    showThemeToggle = false,
    themeMode = 'light',
    onToggleTheme
}) {
    const isDarkMode = themeMode === 'dark';
    const themeToggleLabel = isDarkMode ? 'Light mode' : 'Dark mode';
    const themeToggleAriaLabel = isDarkMode ? 'Switch to light mode' : 'Switch to dark mode';

    return (
        <header className="cst-shell__header">
            <div className="cst-shell__header-inner">
                <div className="cst-shell__header-top">
                    <a className="cst-shell__brand" href={homeHref} aria-label="Back to all tools">
                        CodeSamplez Tools
                    </a>
                    {showThemeToggle ? (
                        <button
                            type="button"
                            className="cst-shell__theme-toggle"
                            aria-pressed={isDarkMode ? 'true' : 'false'}
                            aria-label={themeToggleAriaLabel}
                            title={themeToggleAriaLabel}
                            onClick={onToggleTheme}
                        >
                            <span className="cst-shell__theme-toggle-icon" aria-hidden="true">
                                {isDarkMode ? '☀' : '☾'}
                            </span>
                            <span className="cst-shell__theme-toggle-text">{themeToggleLabel}</span>
                        </button>
                    ) : null}
                </div>
                <div className="cst-shell__title-wrap">
                    <h1 className="cst-shell__title">{title}</h1>
                    {description ? <p className="cst-shell__description">{description}</p> : null}
                </div>
            </div>
        </header>
    );
}

export function ToolShellFooter() {
    return (
        <footer className="cst-shell__footer">
            <div className="cst-shell__footer-inner">
                <span>Client-side by design</span>
                <span aria-hidden="true">|</span>
                <a href="/" className="cst-shell__footer-link">All Tools</a>
            </div>
        </footer>
    );
}
