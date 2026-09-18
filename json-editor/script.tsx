import { hydrate, render } from 'preact';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { copyTextToClipboard } from '../common/clipboard';
import DownloadManager from '../common/DownloadManager';
import { registerDropZone, registerFileInput } from '../common/drop-zone';
import FileUploadButton from '../common/file-upload';
import { mountToolShell } from '../common/app-shell/mountToolShell';
import { NotificationManager } from '../common/notification-manager';
import { isEditableTarget, registerPrimaryActionShortcut } from '../common/shortcut-utils';
import {
    addJsonArrayItem,
    addJsonObjectProperty,
    changeJsonEditorNodeType,
    countJsonEditorNodes,
    createJsonEditorDocument,
    deleteJsonEditorNode,
    duplicateJsonEditorNode,
    findJsonEditorNode,
    findJsonObjectPropertyParent,
    getJsonEditorDepth,
    hasDuplicateJsonObjectKey,
    isValidJsonEditorNumber,
    isJsonEditorContainer,
    moveJsonEditorNode,
    parseJsonEditorIndent,
    parseJsonEditorInput,
    renameJsonObjectProperty,
    serializeJsonEditorNode,
    updateJsonEditorValue,
    type JsonEditorIndent,
    type JsonEditorNode,
    type JsonEditorParseDiagnostics,
    type JsonValueType
} from './json-editor-core';
import toolMetadata from './tool.meta.json';

const HISTORY_LIMIT = 100;
const SAMPLE_JSON = `{
  "name": "CodeSamplez",
  "enabled": true,
  "features": ["visual editing", "local processing"],
  "settings": {
    "indent": 2,
    "theme": null
  }
}`;
const JSON_VALUE_TYPES: JsonValueType[] = ['string', 'number', 'boolean', 'null', 'object', 'array'];

interface JsonEditorHistory {
    past: JsonEditorNode[];
    present: JsonEditorNode;
    future: JsonEditorNode[];
}

type FieldErrors = Record<string, string>;

function createRuntimeIdFactory(): () => string {
    let nextId = 0;
    return () => `json-editor-${nextId += 1}`;
}

function toDomId(value: string): string {
    return value.replace(/[^A-Za-z0-9_-]/g, '-');
}

function typeLabel(type: JsonValueType): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
}

function collectContainerIds(node: JsonEditorNode, target: string[] = []): string[] {
    if (!isJsonEditorContainer(node)) return target;
    target.push(node.id);
    if (node.type === 'array') {
        node.children.forEach((child) => collectContainerIds(child, target));
    } else {
        node.children.forEach((property) => collectContainerIds(property.value, target));
    }
    return target;
}

function getNodeSummary(node: Extract<JsonEditorNode, { type: 'object' | 'array' }>): string {
    if (node.type === 'object') return `${node.children.length} ${node.children.length === 1 ? 'property' : 'properties'}`;
    return `${node.children.length} ${node.children.length === 1 ? 'item' : 'items'}`;
}

function getFallbackDiagnostics(message: string): JsonEditorParseDiagnostics {
    return { message, index: 0, line: 1, column: 1 };
}

function showMutationError(error: unknown): void {
    NotificationManager.show(
        error instanceof Error ? error.message : 'That edit could not be applied.',
        3500,
        { type: 'error' }
    );
}

interface EditableFieldProps {
    fieldId: string;
    value: string;
    ariaLabel: string;
    className?: string;
    error?: string;
    autoFocus?: boolean;
    onAutoFocus?: () => void;
    onCommit: (value: string) => boolean;
    onCancel?: () => void;
}

function EditableField({
    fieldId,
    value,
    ariaLabel,
    className = '',
    error,
    autoFocus = false,
    onAutoFocus,
    onCommit,
    onCancel
}: EditableFieldProps): JSX.Element {
    const [draft, setDraft] = useState(value);
    const previousValueRef = useRef(value);
    const previousErrorRef = useRef(error);
    const committedDraftRef = useRef<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const inputId = `json-editor-field-${toDomId(fieldId)}`;
    const errorId = `${inputId}-error`;

    useEffect(() => {
        const valueChanged = previousValueRef.current !== value;
        const errorCleared = Boolean(previousErrorRef.current) && !error;
        if (valueChanged || errorCleared) {
            previousValueRef.current = value;
            committedDraftRef.current = null;
            setDraft(value);
        }
        previousValueRef.current = value;
        previousErrorRef.current = error;
    }, [error, value]);

    useLayoutEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
            onAutoFocus?.();
        }
    }, [autoFocus, onAutoFocus]);

    const commit = () => {
        if (draft === value || committedDraftRef.current === draft) {
            return true;
        }
        const committed = onCommit(draft);
        if (committed) committedDraftRef.current = draft;
        return committed;
    };

    return (
        <span className="jsone-editable-field">
            <input
                ref={inputRef}
                id={inputId}
                className={`c-input jsone-inline-input ${error ? 'c-input--error ' : ''}${className}`}
                type="text"
                value={draft}
                aria-label={ariaLabel}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? errorId : undefined}
                onInput={(event) => {
                    committedDraftRef.current = null;
                    setDraft((event.currentTarget as HTMLInputElement).value);
                }}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        if (commit()) {
                            (event.currentTarget as HTMLInputElement).blur();
                        }
                    } else if (event.key === 'Escape') {
                        event.preventDefault();
                        committedDraftRef.current = null;
                        setDraft(value);
                        onCancel?.();
                    }
                }}
            />
            {error ? <span id={errorId} className="jsone-field-error" role="alert">{error}</span> : null}
        </span>
    );
}

interface JsonEditorNodeRowProps {
    node: JsonEditorNode;
    label: string;
    propertyId?: string;
    isRoot?: boolean;
    isFirst?: boolean;
    isLast?: boolean;
    collapsedIds: Set<string>;
    fieldErrors: FieldErrors;
    focusTargetId: string | null;
    onAutoFocus: () => void;
    onToggle: (nodeId: string) => void;
    onCommitValue: (nodeId: string, value: string) => boolean;
    onRename: (propertyId: string, value: string) => boolean;
    onChangeType: (nodeId: string, type: JsonValueType) => boolean;
    onAddProperty: (nodeId: string) => void;
    onAddItem: (nodeId: string) => void;
    onDuplicate: (nodeId: string) => void;
    onDelete: (nodeId: string) => void;
    onMove: (nodeId: string, direction: 'up' | 'down') => void;
    onClearFieldError: (fieldId: string) => void;
}

function JsonEditorNodeRow({
    node,
    label,
    propertyId,
    isRoot = false,
    isFirst = false,
    isLast = false,
    collapsedIds,
    fieldErrors,
    focusTargetId,
    onAutoFocus,
    onToggle,
    onCommitValue,
    onRename,
    onChangeType,
    onAddProperty,
    onAddItem,
    onDuplicate,
    onDelete,
    onMove,
    onClearFieldError
}: JsonEditorNodeRowProps): JSX.Element {
    const isContainer = isJsonEditorContainer(node);
    const isExpanded = isContainer && !collapsedIds.has(node.id);
    const childrenId = `json-editor-children-${toDomId(node.id)}`;
    const valueError = fieldErrors[node.id];
    const displayLabel = isRoot ? 'root' : label;
    const typeSelectRef = useRef<HTMLSelectElement>(null);

    useLayoutEffect(() => {
        if (propertyId || focusTargetId !== node.id || !typeSelectRef.current) return;
        typeSelectRef.current.focus();
        onAutoFocus();
    }, [focusTargetId, node.id, onAutoFocus, propertyId]);

    return (
        <div className={`jsone-node jsone-node--${node.type}`} data-node-id={node.id}>
            <div className="jsone-node-row" role="group" aria-label={`${displayLabel} ${node.type}`}>
                {isContainer ? (
                    <button
                        className="jsone-toggle c-button c-button--ghost c-button--icon"
                        type="button"
                        aria-expanded={isExpanded}
                        aria-controls={childrenId}
                        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${displayLabel}`}
                        onClick={() => onToggle(node.id)}
                    >
                        {isExpanded ? '▾' : '▸'}
                    </button>
                ) : <span className="jsone-toggle-placeholder" aria-hidden="true" />}

                <span className="jsone-node-label">
                    {propertyId ? (
                        <EditableField
                            fieldId={`${propertyId}-key`}
                            value={label}
                            ariaLabel={`Key for ${displayLabel}`}
                            className="jsone-key-input"
                            error={fieldErrors[propertyId]}
                            autoFocus={focusTargetId === node.id}
                            onAutoFocus={onAutoFocus}
                            onCommit={(value) => onRename(propertyId, value)}
                            onCancel={() => onClearFieldError(propertyId)}
                        />
                ) : <span className={isRoot ? 'jsone-root-label' : 'jsone-array-index-label'}>{displayLabel}</span>}
                </span>

                <select
                    ref={typeSelectRef}
                    className="c-input jsone-type-select"
                    aria-label={`Type for ${displayLabel}`}
                    value={node.type}
                    onChange={(event) => {
                        const select = event.currentTarget as HTMLSelectElement;
                        if (!onChangeType(node.id, select.value as JsonValueType)) select.value = node.type;
                    }}
                >
                    {JSON_VALUE_TYPES.map((type) => <option key={type} value={type}>{typeLabel(type)}</option>)}
                </select>

                <div className="jsone-node-value">
                    {node.type === 'string' ? (
                        <EditableField
                            fieldId={node.id}
                            value={node.value}
                            ariaLabel={`Value for ${displayLabel}`}
                            className="jsone-value-input"
                            error={valueError}
                            onCommit={(value) => onCommitValue(node.id, value)}
                            onCancel={() => onClearFieldError(node.id)}
                        />
                    ) : null}
                    {node.type === 'number' ? (
                        <EditableField
                            fieldId={node.id}
                            value={String(node.value)}
                            ariaLabel={`Value for ${displayLabel}`}
                            className="jsone-value-input jsone-number-input"
                            error={valueError}
                            onCommit={(value) => onCommitValue(node.id, value)}
                            onCancel={() => onClearFieldError(node.id)}
                        />
                    ) : null}
                    {node.type === 'boolean' ? (
                        <select
                            className="c-input jsone-value-select"
                            aria-label={`Value for ${displayLabel}`}
                            value={node.value ? 'true' : 'false'}
                            onChange={(event) => onCommitValue(node.id, (event.currentTarget as HTMLSelectElement).value)}
                        >
                            <option value="true">true</option>
                            <option value="false">false</option>
                        </select>
                    ) : null}
                    {node.type === 'null' ? <span className="jsone-null-value">null</span> : null}
                    {isContainer ? <span className="jsone-container-summary">{getNodeSummary(node)}</span> : null}
                </div>

                <div className="jsone-node-actions" role="group" aria-label={`Actions for ${displayLabel}`}>
                    {isContainer && node.type === 'object' ? (
                        <button className="c-button c-button--ghost c-button--small jsone-btn-add-property" type="button" onClick={() => onAddProperty(node.id)}>
                            Add property
                        </button>
                    ) : null}
                    {isContainer && node.type === 'array' ? (
                        <button className="c-button c-button--ghost c-button--small jsone-btn-add-item" type="button" onClick={() => onAddItem(node.id)}>
                            Add item
                        </button>
                    ) : null}
                    {!isRoot ? (
                        <>
                            <button
                                className="c-button c-button--ghost c-button--icon"
                                type="button"
                                aria-label={`Move ${displayLabel} up`}
                                title="Move up"
                                disabled={isFirst}
                                onClick={() => onMove(node.id, 'up')}
                            >
                                ↑
                            </button>
                            <button
                                className="c-button c-button--ghost c-button--icon"
                                type="button"
                                aria-label={`Move ${displayLabel} down`}
                                title="Move down"
                                disabled={isLast}
                                onClick={() => onMove(node.id, 'down')}
                            >
                                ↓
                            </button>
                            <button
                                className="c-button c-button--ghost c-button--icon"
                                type="button"
                                aria-label={`Duplicate ${displayLabel}`}
                                title="Duplicate"
                                onClick={() => onDuplicate(node.id)}
                            >
                                ⧉
                            </button>
                            <button
                                className="c-button c-button--ghost c-button--icon jsone-action-delete"
                                type="button"
                                aria-label={`Delete ${displayLabel}`}
                                title="Delete"
                                onClick={() => onDelete(node.id)}
                            >
                                ×
                            </button>
                        </>
                    ) : null}
                </div>
            </div>

            {isContainer ? (
                <div id={childrenId} className="jsone-children" role="group" aria-label={`${displayLabel} children`} hidden={!isExpanded}>
                    {isExpanded && node.type === 'object' ? (
                        node.children.length === 0 ? (
                            <div className="jsone-empty-container">
                                <span>Empty object</span> ·{' '}
                                <button className="jsone-inline-add-btn" type="button" onClick={() => onAddProperty(node.id)}>
                                    + Add property
                                </button>
                            </div>
                        ) : node.children.map((property, index) => (
                            <JsonEditorNodeRow
                                key={property.id}
                                node={property.value}
                                label={property.key}
                                propertyId={property.id}
                                isFirst={index === 0}
                                isLast={index === node.children.length - 1}
                                collapsedIds={collapsedIds}
                                fieldErrors={fieldErrors}
                                focusTargetId={focusTargetId}
                                onAutoFocus={onAutoFocus}
                                onToggle={onToggle}
                                onCommitValue={onCommitValue}
                                onRename={onRename}
                                onChangeType={onChangeType}
                                onAddProperty={onAddProperty}
                                onAddItem={onAddItem}
                                onDuplicate={onDuplicate}
                                onDelete={onDelete}
                                onMove={onMove}
                                onClearFieldError={onClearFieldError}
                            />
                        ))
                    ) : isExpanded ? (
                        node.children.length === 0 ? (
                            <div className="jsone-empty-container">
                                <span>Empty array</span> ·{' '}
                                <button className="jsone-inline-add-btn" type="button" onClick={() => onAddItem(node.id)}>
                                    + Add item
                                </button>
                            </div>
                        ) : node.children.map((child, index) => (
                            <JsonEditorNodeRow
                                key={child.id}
                                node={child}
                                label={`[${index}]`}
                                isFirst={index === 0}
                                isLast={index === node.children.length - 1}
                                collapsedIds={collapsedIds}
                                fieldErrors={fieldErrors}
                                focusTargetId={focusTargetId}
                                onAutoFocus={onAutoFocus}
                                onToggle={onToggle}
                                onCommitValue={onCommitValue}
                                onRename={onRename}
                                onChangeType={onChangeType}
                                onAddProperty={onAddProperty}
                                onAddItem={onAddItem}
                                onDuplicate={onDuplicate}
                                onDelete={onDelete}
                                onMove={onMove}
                                onClearFieldError={onClearFieldError}
                            />
                        ))
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export function JsonEditorApp(): JSX.Element {
    const idFactoryRef = useRef<(() => string) | null>(null);
    if (!idFactoryRef.current) idFactoryRef.current = createRuntimeIdFactory();
    const idFactory = idFactoryRef.current;
    const [history, setHistory] = useState<JsonEditorHistory>(() => ({
        past: [],
        present: createJsonEditorDocument(idFactory),
        future: []
    }));
    const [indent, setIndent] = useState<JsonEditorIndent>(2);
    const [importText, setImportText] = useState('');
    const [importOpen, setImportOpen] = useState(false);
    const [importError, setImportError] = useState<JsonEditorParseDiagnostics | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
    const [focusTargetId, setFocusTargetId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const importDisclosureRef = useRef<HTMLDetailsElement>(null);
    const importTextRef = useRef<HTMLTextAreaElement>(null);
    const importErrorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const downloadManagerRef = useRef<DownloadManager | null>(null);
    // Latest values for the single-registration primary shortcut (see below).
    const importOpenRef = useRef(importOpen);
    const importTextStateRef = useRef(importText);
    const handleCopyRef = useRef<() => void>(() => undefined);
    const handleImportRef = useRef<(input: string, sourceName?: string) => void>(() => undefined);

    const commitDocument = useCallback((next: JsonEditorNode) => {
        setHistory((current) => {
            if (next === current.present) return current;
            const retainedPast = current.past.length >= HISTORY_LIMIT
                ? current.past.slice(current.past.length - HISTORY_LIMIT + 1)
                : current.past;
            return {
                past: [...retainedPast, current.present],
                present: next,
                future: []
            };
        });
        setFieldErrors({});
    }, []);

    const handleImport = useCallback((input: string, sourceName = '') => {
        setImportText(input);
        setImportError(null);

        try {
            const next = parseJsonEditorInput(input, idFactory);
            commitDocument(next);
            setCollapsedIds(new Set());
            NotificationManager.show(
                sourceName === 'sample' ? 'Loaded sample JSON.' : sourceName ? `Imported ${sourceName}.` : 'JSON imported.',
                2200,
                { type: 'success' }
            );
        } catch (error) {
            const diagnostics = error instanceof Error && 'diagnostics' in error
                ? (error as Error & { diagnostics: JsonEditorParseDiagnostics }).diagnostics
                : getFallbackDiagnostics(error instanceof Error ? error.message : String(error));
            setImportError(diagnostics);
        }
    }, [commitDocument, idFactory]);

    useEffect(() => {
        if (importError) importErrorRef.current?.focus();
    }, [importError]);

    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        };
    }, []);

    useLayoutEffect(() => {
        // Single registration on the disclosure (which contains the panel):
        // registering both panel + disclosure double-fires on drop via bubbling.
        const importDisclosure = importDisclosureRef.current;
        const fileInput = fileInputRef.current;
        if (!importDisclosure || !fileInput) return undefined;

        const options = {
            onText: (text: string, file: File) => {
                handleImport(text, file.name);
                setImportOpen(true);
            },
            onError: (message: string) => NotificationManager.show(message, 3500, { type: 'error' })
        };
        const dropCleanup = registerDropZone(importDisclosure, options);
        const fileCleanup = registerFileInput(fileInput, options);
        return () => {
            dropCleanup();
            fileCleanup();
        };
    }, [handleImport]);

    useLayoutEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!(event.metaKey || event.ctrlKey) || event.altKey || isEditableTarget(event.target)) return;
            if (event.key.toLowerCase() === 'z') {
                event.preventDefault();
                if (event.shiftKey) {
                    setHistory((current) => {
                        if (current.future.length === 0) return current;
                        const [next, ...remainingFuture] = current.future;
                        return { past: [...current.past, current.present], present: next, future: remainingFuture };
                    });
                } else {
                    setHistory((current) => {
                        if (current.past.length === 0) return current;
                        const previous = current.past[current.past.length - 1];
                        return {
                            past: current.past.slice(0, -1),
                            present: previous,
                            future: [current.present, ...current.future].slice(0, HISTORY_LIMIT)
                        };
                    });
                }
                setFieldErrors({});
            } else if (event.key.toLowerCase() === 'y') {
                event.preventDefault();
                setHistory((current) => {
                    if (current.future.length === 0) return current;
                    const [next, ...remainingFuture] = current.future;
                    return { past: [...current.past, current.present], present: next, future: remainingFuture };
                });
                setFieldErrors({});
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, []);

    const preview = useMemo(() => {
        try {
            return serializeJsonEditorNode(history.present, indent);
        } catch (error) {
            return error instanceof Error ? `Unable to serialize JSON: ${error.message}` : 'Unable to serialize JSON.';
        }
    }, [history.present, indent]);

    const setFieldError = useCallback((id: string, message: string) => {
        setFieldErrors((current) => ({ ...current, [id]: message }));
    }, []);

    const handleCommitValue = useCallback((nodeId: string, rawValue: string): boolean => {
        const current = findJsonEditorNode(history.present, nodeId);
        if (!current || isJsonEditorContainer(current)) return false;

        if (current.type === 'number') {
            const trimmed = rawValue.trim();
            const numberValue = Number(trimmed);
            if (!isValidJsonEditorNumber(trimmed) || !Number.isFinite(numberValue)) {
                setFieldError(nodeId, 'Enter a valid JSON number.');
                return false;
            }
            commitDocument(updateJsonEditorValue(history.present, nodeId, numberValue));
            return true;
        }

        if (current.type === 'boolean') {
            commitDocument(updateJsonEditorValue(history.present, nodeId, rawValue === 'true'));
            return true;
        }

        commitDocument(updateJsonEditorValue(history.present, nodeId, rawValue));
        return true;
    }, [commitDocument, history.present, setFieldError]);

    const handleRename = useCallback((propertyId: string, key: string): boolean => {
        const parent = findJsonObjectPropertyParent(history.present, propertyId);
        if (!parent || hasDuplicateJsonObjectKey(parent, key, propertyId)) {
            setFieldError(propertyId, `Duplicate object key "${key}".`);
            return false;
        }

        try {
            commitDocument(renameJsonObjectProperty(history.present, propertyId, key));
            return true;
        } catch (error) {
            setFieldError(propertyId, error instanceof Error ? error.message : 'That key cannot be used.');
            return false;
        }
    }, [commitDocument, history.present, setFieldError]);

    const handleChangeType = useCallback((nodeId: string, nextType: JsonValueType): boolean => {
        const current = findJsonEditorNode(history.present, nodeId);
        if (!current || current.type === nextType) return true;
        if (isJsonEditorContainer(current) && current.children.length > 0) {
            const confirmed = window.confirm(`Changing this ${current.type} to ${typeLabel(nextType).toLowerCase()} will remove its ${current.children.length === 1 ? 'child' : 'children'}. Continue?`);
            if (!confirmed) return false;
        }
        try {
            commitDocument(changeJsonEditorNodeType(history.present, nodeId, nextType, idFactory));
            return true;
        } catch (error) {
            showMutationError(error);
            return false;
        }
    }, [commitDocument, history.present, idFactory]);

    const handleAddProperty = useCallback((parentId: string) => {
        try {
            const next = addJsonObjectProperty(history.present, parentId, idFactory);
            const parent = findJsonEditorNode(next, parentId);
            if (parent?.type === 'object' && parent.children.length > 0) {
                setFocusTargetId(parent.children[parent.children.length - 1].value.id);
            }
            setCollapsedIds((current) => {
                if (!current.has(parentId)) return current;
                const nextSet = new Set(current);
                nextSet.delete(parentId);
                return nextSet;
            });
            commitDocument(next);
        } catch (error) {
            showMutationError(error);
        }
    }, [commitDocument, history.present, idFactory]);

    const handleAddItem = useCallback((parentId: string) => {
        try {
            const next = addJsonArrayItem(history.present, parentId, idFactory);
            const parent = findJsonEditorNode(next, parentId);
            if (parent?.type === 'array' && parent.children.length > 0) {
                setFocusTargetId(parent.children[parent.children.length - 1].id);
            }
            setCollapsedIds((current) => {
                if (!current.has(parentId)) return current;
                const nextSet = new Set(current);
                nextSet.delete(parentId);
                return nextSet;
            });
            commitDocument(next);
        } catch (error) {
            showMutationError(error);
        }
    }, [commitDocument, history.present, idFactory]);

    const handleClearFieldError = useCallback((id: string) => {
        setFieldErrors((current) => {
            if (!current[id]) return current;
            const next = { ...current };
            delete next[id];
            return next;
        });
    }, []);

    const handleDuplicate = useCallback((nodeId: string) => {
        try {
            commitDocument(duplicateJsonEditorNode(history.present, nodeId, idFactory));
        } catch (error) {
            showMutationError(error);
        }
    }, [commitDocument, history.present, idFactory]);

    const handleDelete = useCallback((nodeId: string) => {
        commitDocument(deleteJsonEditorNode(history.present, nodeId));
    }, [commitDocument, history.present]);

    const handleMove = useCallback((nodeId: string, direction: 'up' | 'down') => {
        commitDocument(moveJsonEditorNode(history.present, nodeId, direction));
    }, [commitDocument, history.present]);

    const handleUndo = useCallback(() => {
        setHistory((current) => {
            if (current.past.length === 0) return current;
            const previous = current.past[current.past.length - 1];
            return {
                past: current.past.slice(0, -1),
                present: previous,
                future: [current.present, ...current.future].slice(0, HISTORY_LIMIT)
            };
        });
        setFieldErrors({});
    }, []);

    const handleRedo = useCallback(() => {
        setHistory((current) => {
            if (current.future.length === 0) return current;
            const [next, ...remainingFuture] = current.future;
            return { past: [...current.past, current.present], present: next, future: remainingFuture };
        });
        setFieldErrors({});
    }, []);

    const handleClear = useCallback(() => {
        commitDocument(createJsonEditorDocument(idFactory));
        setImportText('');
        setImportError(null);
        setCollapsedIds(new Set());
        NotificationManager.show('Document cleared.', 2200, { type: 'success' });
    }, [commitDocument, idFactory]);

    const handleCopy = useCallback(async () => {
        try {
            await copyTextToClipboard(preview);
            NotificationManager.show('JSON copied to clipboard.', 2200, { type: 'success' });
            setCopied(true);
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
            copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500);
        } catch (error) {
            NotificationManager.show(`Could not copy JSON. ${error instanceof Error ? error.message : String(error)}`, 3500, { type: 'error' });
        }
    }, [preview]);

    const handleDownload = useCallback(() => {
        if (!downloadManagerRef.current) downloadManagerRef.current = new DownloadManager();
        downloadManagerRef.current.downloadFile(preview, 'edited.json', 'application/json');
        NotificationManager.show('Downloaded edited.json.', 2200, { type: 'success' });
    }, [preview]);

    useLayoutEffect(() => {
        importOpenRef.current = importOpen;
        importTextStateRef.current = importText;
        handleCopyRef.current = () => {
            void handleCopy();
        };
        handleImportRef.current = handleImport;
    });

    useLayoutEffect(() => {
        // Registered once; latest state/callbacks are read via refs so tree
        // edits (which recreate handleCopy via `preview`) don't churn the
        // document listener.
        return registerPrimaryActionShortcut(() => {
            if (importOpenRef.current) {
                handleImportRef.current(importTextRef.current?.value ?? importTextStateRef.current);
            } else {
                handleCopyRef.current();
            }
        });
    }, []);

    const handleExpandAll = useCallback(() => setCollapsedIds(new Set()), []);
    const handleCollapseAll = useCallback(() => setCollapsedIds(new Set(collectContainerIds(history.present))), [history.present]);

    const nodeCount = countJsonEditorNodes(history.present);

    return (
        <div id="json-editor-tool" className="tool-container jsone-tool c-tool-stack">
            <div className="jsone-toolbar c-action-strip c-toolbar" role="toolbar" aria-label="JSON Editor actions">
                <div className="jsone-toolbar-actions" role="group" aria-label="Document and history actions">
                    <button className="c-button c-button--ghost" type="button" onClick={() => handleImport(SAMPLE_JSON, 'sample')}>Load Sample</button>
                    <button className="c-button c-button--ghost" type="button" onClick={handleClear}>Clear</button>
                    <span className="jsone-toolbar-divider" aria-hidden="true" />
                    <button className="c-button c-button--secondary" type="button" onClick={handleUndo} disabled={history.past.length === 0} aria-label="Undo last change">Undo</button>
                    <button className="c-button c-button--secondary" type="button" onClick={handleRedo} disabled={history.future.length === 0} aria-label="Redo last undone change">Redo</button>
                </div>
                <label className="jsone-indent-control" htmlFor="json-editor-indent">
                    <span>Indent</span>
                    <select id="json-editor-indent" className="c-input" value={indent} aria-label="Output indentation" onChange={(event) => setIndent(parseJsonEditorIndent((event.currentTarget as HTMLSelectElement).value))}>
                        <option value="2">2 spaces</option>
                        <option value="4">4 spaces</option>
                        <option value="tab">Tabs</option>
                        <option value="minify">Minified</option>
                    </select>
                </label>
            </div>

            <details ref={importDisclosureRef} className="jsone-import-disclosure" open={importOpen} onToggle={(event) => setImportOpen((event.currentTarget as HTMLDetailsElement).open)}>
                <summary>Import JSON <span className="jsone-summary-hint">Paste, upload, or drop strict JSON to replace the document</span></summary>
                <div className="jsone-import-panel c-surface-card">
                    <label className="jsone-field-label" htmlFor="json-editor-import-input">JSON to import</label>
                    <textarea
                        ref={importTextRef}
                        id="json-editor-import-input"
                        className={`c-input c-input--textarea jsone-import-textarea${importError ? ' c-input--error' : ''}`}
                        value={importText}
                        placeholder={'Paste JSON here, for example {"name":"Ada"}'}
                        aria-invalid={importError ? 'true' : undefined}
                        aria-describedby={`json-editor-import-helper${importError ? ' json-editor-import-error' : ''}`}
                        onInput={(event) => setImportText((event.currentTarget as HTMLTextAreaElement).value)}
                    />
                    <p id="json-editor-import-helper" className="jsone-helper">Import replaces the tree. Later tree edits do not change this source text; click Import JSON again to replace the document.</p>
                    <div className="jsone-import-actions">
                        <button className="c-button" type="button" onClick={() => handleImport(importTextRef.current?.value ?? importText)}>
                            Import JSON <span className="c-kbd" aria-hidden="true">⌘⏎</span>
                        </button>
                        <FileUploadButton id="json-editor-file" label="Upload JSON" ariaLabel="Upload JSON file" accept="application/json,.json,text/plain,.txt" inputRef={fileInputRef} />
                        <span className="jsone-drop-hint">or drop a JSON file anywhere in this import section</span>
                    </div>
                    {importError ? (
                        <div ref={importErrorRef} id="json-editor-import-error" className="c-input-status error jsone-import-error" role="alert" tabIndex={-1}>
                            <strong>Import failed:</strong> {importError.message} (line {importError.line}, column {importError.column}). The current document was kept.
                        </div>
                    ) : null}
                </div>
            </details>

            <div className="c-workbench c-workbench--two-col jsone-workbench">
                <section className="c-surface-card c-surface-panel jsone-tree-panel" aria-labelledby="json-editor-tree-heading">
                    <div className="jsone-panel-header">
                        <div>
                            <h2 id="json-editor-tree-heading">Visual builder</h2>
                            <p>Edit keys and values inline, then add, duplicate, delete, or reorder nodes.</p>
                        </div>
                        <div className="jsone-tree-actions" role="group" aria-label="Tree expansion actions">
                            <button className="c-button c-button--secondary c-button--small" type="button" onClick={handleExpandAll}>Expand all</button>
                            <button className="c-button c-button--secondary c-button--small" type="button" onClick={handleCollapseAll}>Collapse all</button>
                        </div>
                    </div>
                    <div className="jsone-tree-scroll">
                        <JsonEditorNodeRow
                            node={history.present}
                            label="root"
                            isRoot
                            collapsedIds={collapsedIds}
                            fieldErrors={fieldErrors}
                            focusTargetId={focusTargetId}
                            onAutoFocus={() => setFocusTargetId(null)}
                            onToggle={(nodeId) => setCollapsedIds((current) => {
                                const next = new Set(current);
                                if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
                                return next;
                            })}
                            onCommitValue={handleCommitValue}
                            onRename={handleRename}
                            onChangeType={handleChangeType}
                            onAddProperty={handleAddProperty}
                            onAddItem={handleAddItem}
                            onDuplicate={handleDuplicate}
                            onDelete={handleDelete}
                            onMove={handleMove}
                            onClearFieldError={handleClearFieldError}
                        />
                    </div>
                    <div className="jsone-tree-status" role="status" aria-live="polite">
                        {nodeCount.toLocaleString()} {nodeCount === 1 ? 'node' : 'nodes'} · depth {getJsonEditorDepth(history.present)} / 100
                    </div>
                </section>

                <section className="c-surface-card c-surface-panel jsone-preview-panel" aria-labelledby="json-editor-preview-heading">
                    <div className="jsone-panel-header">
                        <div>
                            <h2 id="json-editor-preview-heading">Generated JSON</h2>
                            <p>Read-only output from the current tree.</p>
                        </div>
                        <div className="jsone-preview-actions" role="group" aria-label="JSON export actions">
                            <button className="c-button c-button--secondary c-button--small" type="button" onClick={() => void handleCopy()}>{copied ? 'Copied!' : 'Copy'}</button>
                            <button className="c-button c-button--secondary c-button--small c-button--icon-download" type="button" onClick={handleDownload}>Download</button>
                        </div>
                    </div>
                    <textarea id="json-editor-preview" className="c-input c-input--textarea jsone-preview-textarea" readOnly value={preview} aria-label="Generated JSON preview" spellcheck={false} />
                    <p className="jsone-preview-note">Downloads use <code>edited.json</code> with the <code>application/json</code> MIME type. Everything stays in this browser tab.</p>
                </section>
            </div>

            <div id="notification" className="c-notification" role="status" aria-live="polite" />
        </div>
    );
}

export class JSONEditorToolUI {
    constructor(rootSelector = '#json-editor-app') {
        const root = document.querySelector<HTMLElement>(rootSelector) || document.querySelector<HTMLElement>('#json-editor-tool');
        if (!root) throw new Error('JSON Editor root element not found');
        const mount = root.hasChildNodes() ? hydrate : render;
        mount(<JsonEditorApp />, root);
    }
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', () => {
        mountToolShell({
            title: toolMetadata.title,
            description: toolMetadata.description,
            homeHref: '/'
        });
        new JSONEditorToolUI();
    });
}
