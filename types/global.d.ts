declare module '*.css';
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.svg';

declare var __CST_APP_SHELL_CATALOG__: {
    rootPage: {
        title: string;
        description: string;
        rootPath: string;
        absoluteUrl: string;
    };
    groups: Array<{
        id: string;
        label: string;
    }>;
    entries: Array<{
        id: string;
        title: string;
        description: string;
        publicPath: string;
        catalogGroupId: string;
        catalogOrder: number;
    }>;
} | undefined;
