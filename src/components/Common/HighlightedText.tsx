import React from 'react';
import useStore from '@store/store';
import { Hourglass } from '@carbon/icons-react';

interface HighlightedTextProps {
  text: string;
  className?: string;
}

/**
 * Special commands that should be highlighted
 */
const SPECIAL_COMMANDS = ['${includeSelection}'];

/**
 * Renders text with special commands and macro references highlighted
 * Commands (${includeSelection}) are green, macros (${macroName}) are blue
 */
const HighlightedText: React.FC<HighlightedTextProps> = ({ text, className = '' }) => {
  const prompts = useStore((state) => state.prompts);
  const actionQueue = useStore.getState().actionQueue;
  
  if (!text) return null;
  
  // Create a map of macro names to their status
  const macroStatusMap = new Map<string, 'pending' | 'running' | 'completed' | 'error'>();
  actionQueue.forEach(item => {
    macroStatusMap.set(item.macroName, item.status);
  });

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Find all ${...} patterns
  const matches: Array<{ start: number; end: number; content: string; type: 'command' | 'macro' | 'meta' | 'clip' }> = [];
  const regex = /\$\{([^}]+)\}/g;
  let match;
  
  // Create a set of prompt names for quick lookup
  const promptNames = new Set(prompts.map(p => p.name).filter(Boolean));

  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0]; // e.g., "${includeSelection}" or "${macroName}" or "${meta-"field"}"
    const innerContent = match[1].trim(); // e.g., "includeSelection" or "macroName" or 'meta-"field"'
    const start = match.index;
    const end = start + fullMatch.length;
    
    // Check for meta or clip commands first
    const metaClipMatch = fullMatch.match(/\$\{(meta|clip)-"([^"]+)"\}/);
    if (metaClipMatch) {
      const commandType = metaClipMatch[1]; // "meta" or "clip"
      matches.push({ start, end, content: fullMatch, type: commandType as 'meta' | 'clip' });
    }
    // Check for special commands
    else if (SPECIAL_COMMANDS.includes(fullMatch)) {
      matches.push({ start, end, content: fullMatch, type: 'command' });
    } 
    // Check for macro references (only if not already matched as meta/clip)
    else if (promptNames.has(innerContent)) {
      matches.push({ start, end, content: fullMatch, type: 'macro' });
    }
  }

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  // Remove overlapping matches (keep the first one)
  const nonOverlapping: typeof matches = [];
  for (const match of matches) {
    if (nonOverlapping.length === 0 || match.start >= nonOverlapping[nonOverlapping.length - 1].end) {
      nonOverlapping.push(match);
    }
  }

  // Build parts array
  if (nonOverlapping.length === 0) {
    // No special commands or macros, return plain text
    return <span className={className}>{text}</span>;
  }

  nonOverlapping.forEach((match, idx) => {
    // Add text before the match
    if (match.start > lastIndex) {
      const beforeText = text.substring(lastIndex, match.start);
      parts.push(
        <span key={`text-${idx}`}>{beforeText}</span>
      );
    }

    // Add the highlighted command, macro, meta, or clip
    // Commands (like ${includeSelection}) are green, macros are blue, meta/clip are purple
    let colorClass = 'text-green-600 dark:text-green-400';
    let showLoading = false;
    
    if (match.type === 'macro') {
      colorClass = 'text-blue-600 dark:text-blue-400';
      // Check if this macro is currently executing
      const macroName = match.content.match(/\$\{([^}]+)\}/)?.[1]?.trim();
      if (macroName) {
        const status = macroStatusMap.get(macroName);
        showLoading = status === 'pending' || status === 'running';
      }
    } else if (match.type === 'meta' || match.type === 'clip') {
      colorClass = 'text-purple-600 dark:text-purple-400';
    }

    parts.push(
      <span key={`${match.type}-${idx}`} className={`${colorClass} font-mono inline-flex items-center gap-1`}>
        {match.content}
        {showLoading && (
          <Hourglass className="animate-spin inline-block" size={12} />
        )}
      </span>
    );

    lastIndex = match.end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    parts.push(
      <span key="text-end">{remainingText}</span>
    );
  }

  return <span className={className}>{parts}</span>;
};

export default HighlightedText;
