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
            { label: 'JSON Formatter', href: '/json-formatter/' },
            { label: 'JavaScript Minifier', href: '/js-minifier/' },
            { label: 'CSS Minifier', href: '/css-minifier/' }
        ]
    },
    {
        label: 'Encoders & Decoders',
        tools: [
            { label: 'Base64 Converter', href: '/base64-converter/' },
            { label: 'JWT Decoder', href: '/jwt-decoder/' },
            { label: 'JWT Builder', href: '/jwt-builder/' },
            { label: 'QR Code Generator', href: '/qr-code-generator/' },
            { label: 'Data Format Converter', href: '/data-format-converter/' }
        ]
    },
    {
        label: 'Text Analysis & Diff Tools',
        tools: [
            { label: 'Diff Checker', href: '/diff-checker/' },
            { label: 'Text Analyzer', href: '/text-analyzer/' }
        ]
    }
];
