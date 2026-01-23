import { extractTextFromEditorState } from '@api/tools/implementations';

/**
 * Simple text diff utility
 * Returns a human-readable diff between two text strings
 */
export function computeTextDiff(oldText: string, newText: string): string {
  if (oldText === newText) {
    return 'No changes';
  }
  
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  
  // Simple line-by-line diff
  const maxLines = Math.max(oldLines.length, newLines.length);
  const diff: string[] = [];
  
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    
    if (oldLine === undefined) {
      diff.push(`+ ${newLine || ''}`);
    } else if (newLine === undefined) {
      diff.push(`- ${oldLine}`);
    } else if (oldLine !== newLine) {
      diff.push(`- ${oldLine}`);
      diff.push(`+ ${newLine}`);
    } else {
      diff.push(`  ${oldLine}`);
    }
  }
  
  return diff.join('\n');
}

/**
 * Compute diff between two Lexical editor states (as JSON strings)
 */
export function computeEditorStateDiff(
  oldStateJson: string,
  newStateJson: string
): string {
  try {
    const oldState = JSON.parse(oldStateJson);
    const newState = JSON.parse(newStateJson);
    
    const oldText = extractTextFromEditorState(oldState);
    const newText = extractTextFromEditorState(newState);
    
    return computeTextDiff(oldText, newText);
  } catch (error) {
    console.error('Error computing diff:', error);
    return 'Error computing diff';
  }
}

/**
 * Get text preview from a commit snapshot section
 */
export function getSectionTextPreview(sectionStateJson: string): string {
  try {
    const state = JSON.parse(sectionStateJson);
    return extractTextFromEditorState(state);
  } catch (error) {
    console.error('Error extracting text preview:', error);
    return '';
  }
}
