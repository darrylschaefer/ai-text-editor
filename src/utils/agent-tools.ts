import { CANONICAL_TOOLS, LEGACY_TOOLS, toolRegistry } from '@api/tools';

export const availableAgentTools = Object.keys(toolRegistry).filter(name =>
  CANONICAL_TOOLS.has(name) && !LEGACY_TOOLS.has(name) && !['search_text', 'search_semantic'].includes(name));

export const agentToolLabels: Record<string, [string, string]> = {
  search: ['Search documents', 'Find relevant writing by words or meaning.'],
  context_packet_get: ['Gather context', 'Read neighboring passages and related notes.'],
  doc_structure_get: ['Inspect document structure', 'Navigate headings, scenes, and passages.'],
  doc_read: ['Read passages', 'Read the document text needed for a task.'],
  doc_metadata_get: ['Read document properties', 'Read the title, description, tags, and other properties.'],
  selection_read: ['Read selected text', 'Work with the passage selected in the editor.'],
  meta_read: ['Read metadata', 'Read individual metadata fields.'],
  meta_write: ['Update metadata', 'Change descriptions, tags, and custom fields.'],
  edit_preview: ['Preview edits', 'Propose changes without modifying the document.'],
  edit_apply: ['Apply edits', 'Apply proposed changes to your writing.'],
  revision_list: ['List checkpoints', 'Browse saved writing history.'],
  revision_get: ['Read checkpoints', 'Inspect a saved revision and its changes.'],
  revision_diff: ['Compare revisions', 'Compare earlier and later writing.'],
  project_get_tree: ['Browse the library', 'Find documents and folders in this workspace.'],
  doc_create: ['Create documents', 'Create a document in the library.'],
  doc_rename: ['Rename documents', 'Change document titles.'],
  doc_move: ['Move documents', 'Move documents between folders.'],
  snippet_list: ['List notes', 'Find notes attached to a document.'],
  snippet_read: ['Read notes', 'Use a note as reference material.'],
  snippet_create: ['Create notes', 'Save new ideas or reference notes.'],
  snippet_update: ['Update notes', 'Revise existing notes.'],
};
