export function ToolShellHeader({ title, description, homeHref = '/' }) {
    return (
        <header className="cst-shell__header">
            <div className="cst-shell__header-inner">
                <a className="cst-shell__brand" href={homeHref} aria-label="Back to all tools">
                    CodeSamplez Tools
                </a>
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

