import { v4 as uuidv4 } from 'uuid';
import type { DocumentInterface } from '@type/document';

export function importDocumentCopy(doc: DocumentInterface): DocumentInterface {
  return { ...doc, id: uuidv4(), messageCurrent: { ...doc.messageCurrent, id: uuidv4() } };
}
