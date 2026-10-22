import { createContext } from 'react';

// Only the first dialog in a settings destination uses the menu's shell.
// Nested confirmation/configuration dialogs retain their own focus scope.
export const EmbeddedPopupContext = createContext(false);
