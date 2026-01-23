import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import useStore from '@store/store';
import { debug } from '@utils/debug';

const dbg = debug.tag('StyledTextarea');

interface StyledTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  rows?: number;
  maxHeight?: string;
  autoFocus?: boolean;
  autoExpand?: boolean; // If true, expands to fit all content without maxHeight limit
}

/**
 * Special commands that should be highlighted
 */
const SPECIAL_COMMANDS = ['${includeSelection}'];

/**
 * Pattern for meta and snippet commands (e.g., ${meta-"fieldName"} or ${snippet-"snippetName"})
 */
const META_SNIPPET_PATTERN = /\$\{(meta|snippet)-"([^"]+)"\}/g;

/**
 * Available autocomplete options
 */
interface AutocompleteOption {
  value: string;
  label: string;
  type: 'command' | 'action';
}

/**
 * Convert plain text to JSX with highlighted special commands and action references
 * Returns an array of React nodes where special commands and actions are highlighted
 */
const textToHighlighted = (text: string, prompts: any[] = [], isDarkMode: boolean = false): React.ReactNode[] => {
  if (!text) return [''];
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // Find all ${...} patterns
  const matches: Array<{ start: number; end: number; content: string; type: 'command' | 'action' | 'meta' | 'snippet' }> = [];
  const regex = /\$\{([^}]+)\}/g;
  let match;
  
  // Create a set of prompt names for quick lookup
  const promptNames = new Set(prompts.map(p => p.name).filter(Boolean));

  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0]; // e.g., "${includeSelection}" or "${macroName}" or "${meta-"field"}"
    const innerContent = match[1].trim(); // e.g., "includeSelection" or "macroName" or 'meta-"field"'
    const start = match.index;
    const end = start + fullMatch.length;
    
    // Check for meta or snippet commands first
    const metaSnippetMatch = fullMatch.match(/\$\{(meta|snippet)-"([^"]+)"\}/);
    if (metaSnippetMatch) {
      const commandType = metaSnippetMatch[1]; // "meta" or "snippet"
      matches.push({ start, end, content: fullMatch, type: commandType as 'meta' | 'snippet' });
    }
    // Check for special commands
    else if (SPECIAL_COMMANDS.includes(fullMatch)) {
      matches.push({ start, end, content: fullMatch, type: 'command' });
    } 
    // Check for action references (only if not already matched as meta/clip)
    else if (promptNames.has(innerContent)) {
      matches.push({ start, end, content: fullMatch, type: 'action' });
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
  
  // Determine text color based on dark mode - this will be used for regular text
  const textColor = isDarkMode ? 'rgb(243, 244, 246)' : 'rgb(17, 24, 39)'; // gray-100 for dark, gray-900 for light
  
  // Build parts array - always include ALL text
  if (nonOverlapping.length === 0) {
    // No special commands or actions, return plain text wrapped in span with explicit color
    return [<span key="all-text" style={{ color: textColor }}>{text}</span>];
  }
  
  nonOverlapping.forEach((match, idx) => {
    // Add text before the match
    if (match.start > lastIndex) {
      const beforeText = text.substring(lastIndex, match.start);
      parts.push(
        <span key={`text-before-${idx}`} style={{ color: textColor }}>{beforeText}</span>
      );
    }
    
    // Add the highlighted command, action, meta, or clip
    // Commands (like ${includeSelection}) are green, actions are blue, meta/clip are purple
    // Use explicit RGB colors for better compatibility in modals
    let highlightColor = '';
    if (match.type === 'command') {
      highlightColor = 'rgb(22, 163, 74)'; // green-600
    } else if (match.type === 'action') {
      highlightColor = 'rgb(37, 99, 235)'; // blue-600
    } else if (match.type === 'meta' || match.type === 'snippet') {
      highlightColor = 'rgb(147, 51, 234)'; // purple-600
    }
    
    // For dark mode, use lighter colors
    if (isDarkMode) {
      if (match.type === 'command') {
        highlightColor = 'rgb(74, 222, 128)'; // green-400
      } else if (match.type === 'action') {
        highlightColor = 'rgb(96, 165, 250)'; // blue-400
      } else if (match.type === 'meta' || match.type === 'snippet') {
        highlightColor = 'rgb(192, 132, 252)'; // purple-400
      }
    }
    
    parts.push(
      <span key={`${match.type}-${idx}`} style={{ color: highlightColor, fontFamily: 'inherit' }}>
        {match.content}
      </span>
    );
    
    lastIndex = match.end;
  });
  
  // Add remaining text
  if (lastIndex < text.length) {
    const remainingText = text.substring(lastIndex);
    parts.push(
      <span key="text-end" style={{ color: textColor }}>{remainingText}</span>
    );
  }
  
  return parts;
};

const StyledTextarea: React.FC<StyledTextareaProps> = ({
  value,
  onChange,
  onKeyDown,
  onBlur,
  placeholder,
  className = '',
  style,
  disabled = false,
  rows = 1,
  maxHeight = '200px',
  autoFocus = false,
  autoExpand = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );
  const [autocompleteState, setAutocompleteState] = useState<{
    show: boolean;
    position: { top: number; left: number };
    query: string;
    selectedIndex: number;
  } | null>(null);
  
  const prompts = useStore((state) => state.prompts);
  
  // Watch for theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    
    return () => observer.disconnect();
  }, []);
  
  // Function to calculate and set height
  const updateHeight = useCallback(() => {
    if (textareaRef.current) {
      // Reset height to auto to get accurate scrollHeight
      textareaRef.current.style.height = 'auto';
      // Force a reflow to ensure scrollHeight is accurate
      void textareaRef.current.offsetHeight;
      const scrollHeight = textareaRef.current.scrollHeight;
      
      let newHeight: string;
      let shouldShowScrollbar: boolean;
      
      if (autoExpand) {
        // No maxHeight limit - expand to fit all content
        // Use scrollHeight directly to fit all content
        newHeight = `${scrollHeight}px`;
        shouldShowScrollbar = false;
      } else {
        const maxHeightPx = parseInt(maxHeight) || 200;
        newHeight = `${Math.min(scrollHeight, maxHeightPx)}px`;
        shouldShowScrollbar = scrollHeight > maxHeightPx;
      }
      
      // Set height explicitly to prevent shrinking
      textareaRef.current.style.height = newHeight;
      textareaRef.current.style.overflowY = shouldShowScrollbar ? 'auto' : 'hidden';
      
      // Sync overlay height
      if (overlayRef.current) {
        overlayRef.current.style.height = newHeight;
        overlayRef.current.style.overflowY = shouldShowScrollbar ? 'auto' : 'hidden';
      }
    }
  }, [autoExpand, maxHeight, rows]);
  
  // Auto-resize textarea and sync overlay
  useEffect(() => {
    updateHeight();
  }, [value, updateHeight]);
  
  // Sync scroll between textarea and overlay
  const handleScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);
  
  // Sync overlay highlighting and height
  useEffect(() => {
    if (overlayRef.current && textareaRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
      // Match height - use computed height to ensure consistency
      const textareaHeight = textareaRef.current.style.height || `${textareaRef.current.scrollHeight}px`;
      overlayRef.current.style.height = textareaHeight;
    }
  }, [value]);
  
  // Get autocomplete options based on query
  const getAutocompleteOptions = useCallback((query: string): AutocompleteOption[] => {
    const options: AutocompleteOption[] = [];
    const queryLower = query.toLowerCase();
    
    // Get current document info
    const chats = useStore.getState().chats;
    const currentChatIndex = useStore.getState().currentChatIndex;
    
    // Add special commands
    const specialCommands: AutocompleteOption[] = [
      { value: '${includeSelection}', label: 'includeSelection', type: 'command' },
    ];
    
    // Filter special commands by query (empty query shows all)
    specialCommands.forEach(cmd => {
      if (!query || cmd.label.toLowerCase().includes(queryLower)) {
        options.push(cmd);
      }
    });
    
    // Add available actions (prompts)
    prompts.forEach(prompt => {
      if (prompt.name && (!query || prompt.name.toLowerCase().includes(queryLower))) {
        options.push({
          value: `\${${prompt.name}}`,
          label: prompt.name,
          type: 'action',
        });
      }
    });
    
    // Add meta and clip commands if query starts with "meta" or "clip"
    if (!query || queryLower.startsWith('meta')) {
      // Get available meta fields from current document
      if (chats && currentChatIndex >= 0 && chats[currentChatIndex]) {
        const currentDoc = chats[currentChatIndex];
        const reservedFields = ['title', 'description', 'tags'];
        const customMeta = currentDoc.meta || {};
        const allMetaFields = [...reservedFields, ...Object.keys(customMeta)];
        
        allMetaFields.forEach(field => {
          if (!query || field.toLowerCase().includes(queryLower.replace('meta', '').trim())) {
            options.push({
              value: `\${meta-"${field}"}`,
              label: `meta-"${field}"`,
              type: 'command',
            });
          }
        });
      } else {
        // No document open, show template
        if (!query || queryLower.includes('meta')) {
          options.push({
            value: '${meta-""}',
            label: 'meta-""',
            type: 'command',
          });
        }
      }
    }
    
    if (!query || queryLower.startsWith('snippet')) {
      // Get available snippets from current document
      if (chats && currentChatIndex >= 0 && chats[currentChatIndex]) {
        const currentDoc = chats[currentChatIndex];
        const snippets = currentDoc.snippets || [];
        
        snippets.forEach((snippet: any) => {
          const snippetName = snippet.name || 'unnamed';
          if (!query || snippetName.toLowerCase().includes(queryLower.replace('snippet', '').trim())) {
            options.push({
              value: `\${snippet-"${snippetName}"}`,
              label: `snippet-"${snippetName}"`,
              type: 'command',
            });
          }
        });
      } else {
        // No document open, show template
        if (!query || queryLower.includes('snippet')) {
          options.push({
            value: '${snippet-""}',
            label: 'snippet-""',
            type: 'command',
          });
        }
      }
    }
    
    return options;
  }, [prompts]);
  
  // Detect autocomplete trigger and position
  useEffect(() => {
    if (!isFocused || !textareaRef.current) {
      setAutocompleteState(null);
      return;
    }
    
    // Use a small delay to ensure value and cursor position are updated
    const timeoutId = setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      
      const cursorPos = textarea.selectionStart;
      const textBeforeCursor = value.substring(0, cursorPos);
      
      // Find the last ${ pattern before cursor
      const lastDollarBrace = textBeforeCursor.lastIndexOf('${');
      if (lastDollarBrace === -1) {
        setAutocompleteState(null);
        return;
      }
      
      // Check if there's a closing } after ${ but before cursor
      const textAfterDollarBrace = textBeforeCursor.substring(lastDollarBrace + 2);
      const closingBraceIndex = textAfterDollarBrace.indexOf('}');
      if (closingBraceIndex !== -1) {
        // Already closed, don't show autocomplete
        setAutocompleteState(null);
        return;
      }
      
      // Extract query (text after ${)
      const query = textAfterDollarBrace;
      const options = getAutocompleteOptions(query);
      
      dbg.log('Autocomplete check:', {
        query,
        optionsCount: options.length,
        options,
        cursorPos,
        textBeforeCursor,
        lastDollarBrace,
      });
      
      if (options.length === 0) {
        setAutocompleteState(null);
        return;
      }
      
      // Get textarea position (viewport-relative for fixed positioning)
      const rect = textarea.getBoundingClientRect();
      
      // Calculate position for dropdown - position it below the textarea
      const paddingLeft = parseFloat(getComputedStyle(textarea).paddingLeft) || 0;
      
      // Position it at the bottom of the textarea, accounting for scroll
      const top = rect.bottom + window.scrollY + 4;
      const left = rect.left + window.scrollX + paddingLeft;
      
      dbg.log('Setting autocomplete state:', {
        show: true,
        position: { top, left },
        query,
        rect: textarea.getBoundingClientRect(),
        paddingLeft,
      });
      
      setAutocompleteState({
        show: true,
        position: { top, left },
        query,
        selectedIndex: 0,
      });
    }, 50);
    
    return () => clearTimeout(timeoutId);
  }, [value, isFocused, getAutocompleteOptions]);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);
  
  // Handle autocomplete keyboard navigation
  const handleAutocompleteKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!autocompleteState) {
      onKeyDown?.(e);
      return;
    }
    
    const options = getAutocompleteOptions(autocompleteState.query);
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAutocompleteState(prev => prev ? {
        ...prev,
        selectedIndex: Math.min(prev.selectedIndex + 1, options.length - 1),
      } : null);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAutocompleteState(prev => prev ? {
        ...prev,
        selectedIndex: Math.max(prev.selectedIndex - 1, 0),
      } : null);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (options.length > 0 && autocompleteState.selectedIndex < options.length) {
        e.preventDefault();
        const selected = options[autocompleteState.selectedIndex];
        const textarea = textareaRef.current;
        if (textarea) {
          const cursorPos = textarea.selectionStart;
          const textBeforeCursor = value.substring(0, cursorPos);
          const lastDollarBrace = textBeforeCursor.lastIndexOf('${');
          
          if (lastDollarBrace !== -1) {
            const newValue = 
              value.substring(0, lastDollarBrace) + 
              selected.value + 
              value.substring(cursorPos);
            
            onChange(newValue);
            
            // Set cursor after inserted command
            setTimeout(() => {
              if (textareaRef.current) {
                const newCursorPos = lastDollarBrace + selected.value.length;
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
              }
            }, 0);
          }
        }
        setAutocompleteState(null);
      } else {
        onKeyDown?.(e);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setAutocompleteState(null);
    } else {
      onKeyDown?.(e);
    }
  }, [autocompleteState, getAutocompleteOptions, value, onChange, onKeyDown]);
  
  // Handle autocomplete selection
  const handleSelectOption = useCallback((option: AutocompleteOption) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastDollarBrace = textBeforeCursor.lastIndexOf('${');
    
    if (lastDollarBrace !== -1) {
      const newValue = 
        value.substring(0, lastDollarBrace) + 
        option.value + 
        value.substring(cursorPos);
      
      onChange(newValue);
      
      // Set cursor after inserted command
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = lastDollarBrace + option.value.length;
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          textareaRef.current.focus();
        }
      }, 0);
    }
    
    setAutocompleteState(null);
  }, [value, onChange]);
  
  const showPlaceholder = !value && !isFocused;
  
  const highlightedContent = textToHighlighted(value, prompts, isDarkMode);
  // Check if there are any ${...} patterns (commands or actions)
  const hasHighlighting = SPECIAL_COMMANDS.some(cmd => value.includes(cmd)) || 
    /\$\{[^}]+\}/.test(value);
  
  // Get computed styles for overlay matching
  const [textareaStyles, setTextareaStyles] = useState<{
    padding: string;
    margin: string;
    font: string;
    lineHeight: string;
    border: string;
    color: string;
    letterSpacing: string;
    wordSpacing: string;
    tabSize: string;
    fontKerning: string;
    textRendering: string;
  } | null>(null);
  
  useEffect(() => {
    if (textareaRef.current && hasHighlighting) {
      const computed = getComputedStyle(textareaRef.current);
      // Use explicit colors based on dark mode instead of computed color
      // Check if we're in a modal context (parent has high z-index)
      const parent = textareaRef.current.parentElement;
      const isInModal = parent?.closest('[class*="z-["]') || parent?.closest('[style*="z-index"]');
      const textColor = isDarkMode ? 'rgb(243, 244, 246)' : 'rgb(17, 24, 39)'; // gray-100 for dark, gray-900 for light
      setTextareaStyles({
        padding: `${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft}`,
        margin: `${computed.marginTop} ${computed.marginRight} ${computed.marginBottom} ${computed.marginLeft}`,
        font: computed.font,
        lineHeight: computed.lineHeight,
        border: computed.border,
        color: textColor,
        letterSpacing: computed.letterSpacing,
        wordSpacing: computed.wordSpacing,
        tabSize: computed.tabSize || '8',
        fontKerning: computed.fontKerning,
        textRendering: computed.textRendering,
      });
    } else if (!hasHighlighting) {
      // Clear styles when no highlighting
      setTextareaStyles(null);
    }
  }, [hasHighlighting, value, isDarkMode]);
  
  // Get the text color to use for the overlay
  const overlayTextColor = isDarkMode ? 'rgb(243, 244, 246)' : 'rgb(17, 24, 39)';
  
  return (
    <div className="relative w-full" style={{ position: 'relative', isolation: 'isolate' }}>
      {/* Overlay for highlighting - only shown when there are special commands */}
      {hasHighlighting && textareaStyles && (
        <div
          ref={overlayRef}
          className="absolute top-0 left-0 w-full pointer-events-none"
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            padding: textareaStyles.padding,
            margin: textareaStyles.margin,
            border: '1px solid transparent',
            font: textareaStyles.font,
            lineHeight: textareaStyles.lineHeight,
            letterSpacing: textareaStyles.letterSpacing,
            wordSpacing: textareaStyles.wordSpacing,
            tabSize: textareaStyles.tabSize,
            fontKerning: textareaStyles.fontKerning as any,
            textRendering: textareaStyles.textRendering as any,
            minHeight: `${rows * 24}px`,
            zIndex: 2,
            boxSizing: 'border-box',
            backgroundColor: 'transparent',
            color: overlayTextColor, // Use explicit color instead of textareaStyles.color
            overflow: 'hidden',
            position: 'absolute',
          }}
          aria-hidden="true"
        >
          <div style={{ 
            color: overlayTextColor,
            display: 'block',
            width: '100%',
            position: 'relative',
            backgroundColor: 'transparent',
          }}>
            {highlightedContent}
          </div>
        </div>
      )}
      
      {/* Actual textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleAutocompleteKeyDown}
        onScroll={handleScroll}
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => {
          setIsFocused(false);
          // Recalculate height on blur to ensure it fits content
          // Use setTimeout to ensure DOM has settled after any style changes
          setTimeout(() => {
            updateHeight();
          }, 0);
          // Close autocomplete if clicking outside
          setTimeout(() => {
            const activeElement = document.activeElement;
            if (!autocompleteRef.current?.contains(activeElement as Node)) {
              setAutocompleteState(null);
            }
          }, 100);
          onBlur?.(e);
        }}
        placeholder={showPlaceholder ? placeholder : undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${hasHighlighting ? 'relative z-[3]' : ''}`}
        style={{
          ...style,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          minHeight: `${rows * 24}px`,
          backgroundColor: hasHighlighting ? 'transparent' : (style?.backgroundColor || undefined),
          color: hasHighlighting ? 'transparent' : (style?.color || undefined),
          caretColor: hasHighlighting 
            ? (isDarkMode ? 'rgb(243, 244, 246)' : 'rgb(17, 24, 39)')
            : (style?.caretColor as string) || undefined,
          WebkitTextFillColor: hasHighlighting ? 'transparent' : undefined,
          textShadow: hasHighlighting ? '0 0 0 transparent' : undefined,
          position: 'relative',
        }}
      />
      
      {/* Autocomplete dropdown - rendered via portal to avoid clipping */}
      {autocompleteState && autocompleteState.show && typeof document !== 'undefined' && createPortal(
        <div
          ref={autocompleteRef}
          className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800/30 py-1 min-w-[200px] max-w-[300px] max-h-[200px] overflow-y-auto"
          style={{
            top: `${autocompleteState.position.top}px`,
            left: `${autocompleteState.position.left}px`,
            position: 'fixed',
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {getAutocompleteOptions(autocompleteState.query).map((option, index) => (
            <div
              key={`${option.type}-${option.value}`}
              className={`px-3 py-1.5 cursor-pointer text-sm transition-colors ${
                index === autocompleteState.selectedIndex
                  ? 'bg-gray-100 dark:bg-gray-700'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-750'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelectOption(option);
              }}
              onMouseEnter={() => {
                setAutocompleteState(prev => prev ? { ...prev, selectedIndex: index } : null);
              }}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  option.type === 'command'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                }`}>
                  {option.type === 'command' ? 'Cmd' : 'Action'}
                </span>
                <span className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                  {option.value}
                </span>
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default StyledTextarea;

