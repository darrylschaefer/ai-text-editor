import { describe, expect, it } from 'vitest';
import { _defaultChatConfig } from '@constants/chat';
import { validateAndFixChats } from '@utils/import';

const importedDocument = () => ({
  id: 'imported-document', title: 'Imported writing', editorState: 'saved writing',
  messageCurrent: { messages: [] },
});

describe('imported model choices', () => {
  it('preserves an unknown model and its connection without treating it as available', () => {
    const doc = { ...importedDocument(), config: { ..._defaultChatConfig, model: 'provider-future-model', connectionId: 'other-device-connection' } };
    const writing = doc.editorState;
    expect(validateAndFixChats([doc])).toBe(true);
    expect(doc.config.model).toBe('provider-future-model');
    expect(doc.config.connectionId).toBe('other-device-connection'); expect(doc.editorState).toBe(writing);
  });
  it('accepts an unconfigured empty model instead of requiring a bundled model', () => {
    const doc = { ...importedDocument(), config: { ..._defaultChatConfig, model: '' } };
    expect(validateAndFixChats([doc])).toBe(true); expect(doc.config.model).toBe('');
  });
});
