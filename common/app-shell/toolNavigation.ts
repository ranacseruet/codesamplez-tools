export interface ToolNavigationItem {
    label: string;
    href: string;
}

export interface ToolNavigationGroup {
    label: string;
    tools: ToolNavigationItem[];
}

export const TOOL_NAVIGATION_GROUPS: ToolNavigationGroup[] = [
    {
        label: 'Code Formatters & Validators',
        tools: [
            { label: 'JSON Formatter', href: '/json-formatter-tool/' },
            { label: 'JavaScript Minifier', href: '/js-minifier-tool/' },
            { label: 'CSS Minifier', href: '/css-minifier-tool/' }
        ]
    },
    {
        label: 'Encoders & Decoders',
        tools: [
            { label: 'Base64 Converter', href: '/base64-converter-tool/' },
            { label: 'JWT Decoder', href: '/jwt-decoder-tool/' },
            { label: 'JWT Builder', href: '/jwt-builder-tool/' },
            { label: 'QR Code Generator', href: '/qr-code-generator/' },
            { label: 'Data Format Converter', href: '/data-format-converter/' }
        ]
    },
    {
        label: 'Text Analysis & Diff Tools',
        tools: [
            { label: 'Diff Checker', href: '/diff-checker-tool/' },
            { label: 'Text Analyzer', href: '/text-analyzer-tool/' }
        ]
    }
];
