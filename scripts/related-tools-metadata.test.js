/** @jest-environment node */

const { RELATED_TOOL_REASONS, getRelatedToolReason } = require('./related-tools-metadata');
const { getToolDefinitions } = require('./tool-manifest');

// Long enough to say something specific, short enough to sit on one or two
// lines — the section has no line clamp, so overlong copy makes cards ragged
// rather than quietly truncating.
const MAX_REASON_LENGTH = 70;

describe('related tool reasons', () => {
    it('covers every relatedToolIds pair in the manifest', () => {
        // A missing pair would otherwise only surface as a thrown error during a
        // production build, long after the tool.meta.json edit that caused it.
        getToolDefinitions().forEach((tool) => {
            tool.relatedToolIds.forEach((relatedToolId) => {
                expect(() => getRelatedToolReason(tool.id, relatedToolId)).not.toThrow();
                expect(getRelatedToolReason(tool.id, relatedToolId)).not.toBe('');
            });
        });
    });

    it('registers no copy for pairs the manifest does not declare', () => {
        // Keeps the module from accumulating orphaned lines for relationships
        // that no longer exist.
        const declaredPairs = new Set();
        getToolDefinitions().forEach((tool) => {
            tool.relatedToolIds.forEach((relatedToolId) => {
                declaredPairs.add(`${tool.id} -> ${relatedToolId}`);
            });
        });

        Object.keys(RELATED_TOOL_REASONS).forEach((sourceToolId) => {
            Object.keys(RELATED_TOOL_REASONS[sourceToolId]).forEach((targetToolId) => {
                expect(declaredPairs).toContain(`${sourceToolId} -> ${targetToolId}`);
            });
        });
    });

    it('keeps every line short enough to render without truncation', () => {
        Object.keys(RELATED_TOOL_REASONS).forEach((sourceToolId) => {
            Object.keys(RELATED_TOOL_REASONS[sourceToolId]).forEach((targetToolId) => {
                const reason = RELATED_TOOL_REASONS[sourceToolId][targetToolId];
                expect(reason.length).toBeLessThanOrEqual(MAX_REASON_LENGTH);
            });
        });
    });

    it('says something different about each target, not the same line twice', () => {
        // The whole point of pair-keyed copy is that a tool reads differently
        // depending on where you came from; duplicates mean it reverted to a
        // generic pitch.
        Object.keys(RELATED_TOOL_REASONS).forEach((sourceToolId) => {
            const reasons = Object.values(RELATED_TOOL_REASONS[sourceToolId]);
            expect(new Set(reasons).size).toBe(reasons.length);
        });
    });

    it('throws for an unknown source tool', () => {
        expect(() => getRelatedToolReason('not-a-real-tool', 'json-formatter-tool'))
            .toThrow('No related-tool copy registered for source tool: not-a-real-tool');
    });

    it('throws for a pair with no copy rather than falling back to generic text', () => {
        expect(() => getRelatedToolReason('json-formatter-tool', 'css-minifier-tool'))
            .toThrow('No related-tool copy for pair json-formatter-tool -> css-minifier-tool');
    });
});
