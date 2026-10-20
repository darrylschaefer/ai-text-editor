import { DocumentInterface } from '@type/document';
import { getVersionState } from '@utils/document-versions';

export const EMPTY_EDITOR_STATE = '{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';

export function documentEditorState(doc: DocumentInterface | null) {
  if (!doc) return EMPTY_EDITOR_STATE;
  const section = getVersionState(doc);
  // Missing fields belong to older documents. A present empty string means
  // that this section is intentionally blank and must not load another one.
  return section || EMPTY_EDITOR_STATE;
}
