import { TextEncoder, TextDecoder } from 'util';
import { getAppShellCatalogDefinition } from './scripts/app-shell-catalog';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.__CST_APP_SHELL_CATALOG__ = getAppShellCatalogDefinition();
