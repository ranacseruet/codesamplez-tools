import type { JSX } from 'preact';
import { ToolArticleNextSteps, ToolArticleSection, ToolFaqList, type ToolArticleProps, type ToolFaqItem } from '../common/tool-article/ToolArticle';

function createFaqItem(question: string, answer: string): ToolFaqItem {
    return { question, answer, structuredDataAnswer: answer };
}

export const FAQ_ITEMS: ToolFaqItem[] = [
    createFaqItem(
        'What is a JSON Editor?',
        'A JSON Editor is a visual tool for building and changing JSON objects and arrays without hand-editing every bracket, quote, or comma. This editor shows the document as a tree and generates valid JSON from the current values.'
    ),
    createFaqItem(
        'Can I import an existing JSON file?',
        'Yes. Paste strict JSON into the Import JSON panel, choose Upload JSON, or drop a JSON file onto the import area. A successful import replaces the current tree; an invalid import leaves the current document unchanged and reports the detected line and column.'
    ),
    createFaqItem(
        'Can I edit JSON arrays and objects visually?',
        'Yes. Add properties to objects and items to arrays, edit keys and primitive values inline, duplicate or delete nodes, and move siblings up or down. The root can be changed between all supported JSON types.'
    ),
    createFaqItem(
        'Does this JSON Editor validate the output?',
        'The editor only commits valid JSON value types and rejects invalid numbers and duplicate object keys. Its read-only preview is serialized from the tree, so it shows the document that will be copied or downloaded. Because browser JavaScript follows JSON.parse number semantics, very large integer literals can be rounded and duplicate import keys keep the last occurrence; use strings for exact large identifiers.'
    ),
    createFaqItem(
        'Is my JSON sent to a server?',
        'No. The editor parses, changes, serializes, copies, and downloads JSON locally in your browser. JSON content is not added to analytics, saved by this tool, or transmitted to a server.'
    ),
    createFaqItem(
        'Can I undo and redo JSON Editor changes?',
        'Yes. Imports, edits, type changes, add/delete/duplicate/reorder operations, sample loading, and clearing are undoable. The editor keeps up to 100 committed history steps and starts a new history branch after a new edit.'
    ),
    createFaqItem(
        'How do I export the JSON I built?',
        'Choose Copy to put the generated JSON on the clipboard, or choose Download to save it as edited.json with the application/json MIME type. Select 2 spaces, 4 spaces, tabs, or minified output before exporting.'
    ),
    createFaqItem(
        'What are the JSON Editor size limits?',
        'Imports are limited to 5 MiB, 10,000 value nodes, and a maximum nesting depth of 100. These limits keep a client-side visual editor responsive and prevent unexpectedly large browser workloads.'
    ),
    createFaqItem(
        'Does the editor support JSON5, JSONC, or comments?',
        'No. Version 1 accepts strict JSON through JSON.parse, so comments, trailing commas, single-quoted strings, and unquoted keys are rejected. Convert JSON5 or JSONC to strict JSON before importing it.'
    ),
    createFaqItem(
        'What happens when I change a container type?',
        'Changing a non-empty object or array to another type removes its child nodes, so the editor asks for confirmation first. Primitive conversions use a safe value for the selected type, and Escape restores an unfinished inline edit.'
    )
];

export interface ToolHowToStep {
    name: string;
    text: string;
}

export const HOWTO_STEPS: ToolHowToStep[] = [
    {
        name: 'Start with an empty document or import JSON',
        text: 'The editor starts with an empty object. Open Import JSON, paste strict JSON, upload a file, or drop one onto the import area, then choose Import JSON.'
    },
    {
        name: 'Edit the visual tree',
        text: 'Edit an object key or primitive value inline. Press Enter or click away to commit a change; press Escape to restore the previous value.'
    },
    {
        name: 'Add and organize nodes',
        text: 'Use Add property or Add item, then use the duplicate, delete, and move controls on each child row. Expand all or collapse all to manage nested documents.'
    },
    {
        name: 'Choose preview formatting',
        text: 'Select 2 spaces, 4 spaces, tabs, or Minified from the Preview menu. The generated JSON preview updates after each committed tree change.'
    },
    {
        name: 'Copy or download the result',
        text: 'Use Copy for the clipboard or Download for an edited.json file. Undo and redo remain available for the current editing session.'
    }
];

export const FEATURE_LIST: string[] = [
    'Visual object and array tree builder',
    'Strict JSON paste, file import, and drop-zone support',
    'Inline key and value editing for every JSON value type',
    'Add, duplicate, delete, and move properties or array items',
    'Root type changes with confirmation for destructive container changes',
    'Bounded undo and redo history with up to 100 steps',
    'Selectable 2-space, 4-space, tab, and minified preview output',
    'Copy to clipboard and download as edited.json',
    'Client-side processing with import, node, and depth safety limits'
];

export function JsonEditorIntro(): JSX.Element {
    return (
        <section className="c-tool-article c-tool-article--intro c-surface-card" aria-labelledby="json-editor-intro-heading">
            <div className="c-tool-article__content">
                <h2 id="json-editor-intro-heading" className="c-tool-article__eyebrow">About This Tool</h2>
                <p className="c-tool-article__lead">
                    Use this free online JSON editor to build and edit JSON objects and arrays. Assemble configuration,
                    API payload, or fixture data by editing keys and values in a tree, then copy or download the
                    generated JSON without hand-counting brackets and commas.
                </p>
                <p className="c-tool-article__lead">
                    Start with an empty object or import strict JSON from your clipboard or a local file. The editor
                    processes content in your browser, keeps the current document when an import is invalid, and
                    provides undo, redo, formatting choices, and a read-only output preview.
                </p>
            </div>
        </section>
    );
}

export function JsonEditorArticle({ relatedTools }: ToolArticleProps): JSX.Element {
    return (
        <section className="c-tool-article c-surface-card" aria-labelledby="json-editor-article-heading">
            <div className="c-tool-article__content">
                <h2 id="json-editor-article-heading" className="c-tool-article__sr-only">JSON Editor Guide</h2>

                <ToolArticleSection id="json-editor-features" title="JSON Editor Features">
                    <ul>
                        <li><strong>Visual tree builder:</strong> Work with objects and arrays as readable nested rows instead of raw punctuation.</li>
                        <li><strong>Inline editing:</strong> Change object keys and string, number, or boolean values while null stays an explicit JSON value.</li>
                        <li><strong>Structure controls:</strong> Add properties or items, duplicate a node, delete it, and move siblings up or down.</li>
                        <li><strong>Safe commits:</strong> Invalid numbers and duplicate keys are rejected without replacing the last valid document.</li>
                        <li><strong>History:</strong> Undo and redo imports, edits, type changes, and structure changes for the current tab session.</li>
                        <li><strong>Local export:</strong> Copy the read-only generated JSON or download it as <code>edited.json</code>.</li>
                    </ul>
                    <ToolArticleNextSteps relatedTools={relatedTools} />
                </ToolArticleSection>

                <ToolArticleSection id="json-editor-how-to-use" title="How to Build JSON (Step-by-Step)">
                    <ol>
                        {HOWTO_STEPS.map((step) => (
                            <li key={step.name}>
                                <strong>{step.name}</strong>
                                <p>{step.text}</p>
                            </li>
                        ))}
                    </ol>
                    <p><strong>Example JSON:</strong></p>
                    <pre><code>{`{
  "service": "billing",
  "retry": {
    "enabled": true,
    "attempts": 3
  },
  "regions": ["ca-central-1", "us-east-1"]
}`}</code></pre>
                </ToolArticleSection>

                <ToolArticleSection id="json-editor-limitations" title="JSON Editor Limits and Current Scope">
                    <ul>
                        <li>Input and editing are limited to 5 MiB, 10,000 value nodes, and 100 levels of nesting.</li>
                        <li>Only strict JSON is accepted; JSON5, JSONC, comments, trailing commas, and unquoted keys are not supported.</li>
                        <li>JSON numbers use browser JavaScript precision; integer literals outside the safe range may be rounded, and duplicate import keys follow JSON.parse with the last value retained. Use strings for exact large identifiers.</li>
                        <li>The generated preview is read-only in version 1; edit the visual tree to change output.</li>
                        <li>Search/filtering, JSON Schema validation, share links, local persistence, and tree reparenting are not part of this release.</li>
                        <li>Clipboard access depends on browser permissions; the shared fallback is used when available.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="json-editor-privacy" title="Privacy and Local Processing">
                    <p>
                        Import, editing, serialization, clipboard preparation, and download generation happen in the
                        browser tab. The tool does not upload JSON, include JSON content in analytics, or persist the
                        document after the tab is closed.
                    </p>
                </ToolArticleSection>

                <ToolArticleSection id="json-editor-browser-support" title="Browser Support">
                    <ul>
                        <li><strong>Modern browsers:</strong> Chrome, Firefox, Safari, and Edge.</li>
                        <li><strong>Requirements:</strong> JavaScript enabled, with file and clipboard permissions available for those actions.</li>
                        <li><strong>Mobile:</strong> Responsive controls and a scrollable tree support touch-sized screens.</li>
                    </ul>
                </ToolArticleSection>

                <ToolArticleSection id="json-editor-faqs" title="JSON Editor FAQs">
                    <ToolFaqList items={FAQ_ITEMS} />
                </ToolArticleSection>
            </div>
        </section>
    );
}
