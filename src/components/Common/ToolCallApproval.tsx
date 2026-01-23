import React from 'react';
import { Checkmark, Close } from '@carbon/icons-react';
import { debug } from '@utils/debug';

const dbg = debug.tag('ToolCallApproval');

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
}

interface ToolCallApprovalProps {
  toolCall: ToolCall;
  onApprove: () => void;
  onReject: () => void;
  isProcessing?: boolean;
}

const ToolCallApproval: React.FC<ToolCallApprovalProps> = ({
  toolCall,
  onApprove,
  onReject,
  isProcessing = false,
}) => {
  dbg.log('Rendering with toolCall:', toolCall);
  
  // Check if this tool requires approval
  const requiresApproval = [
    'doc_create',
    'doc_rename',
    'doc_move',
    'edit_apply',
    'meta_write',
    'clip_create',
    'clip_update',
  ].includes(toolCall.name);

  dbg.log('Requires approval?', requiresApproval, 'tool name:', toolCall.name);

  if (!requiresApproval) {
    dbg.log('Tool does not require approval, returning null');
    return null;
  }

  // Format tool call for display
  const formatToolCall = () => {
    const toolName = toolCall.name;
    const args = toolCall.arguments;

    switch (toolName) {
      case 'doc_create':
        return {
          title: 'Create Document',
          description: `Create a new document titled "${args.title || 'Untitled'}"`,
          details: [
            args.folder_id && `Folder: ${args.folder_id}`,
            args.doc_type && `Type: ${args.doc_type}`,
            args.position !== null && args.position !== undefined && `Position: ${args.position}`,
          ].filter(Boolean),
        };
      case 'doc_rename':
        return {
          title: 'Rename Document',
          description: `Rename document to "${args.new_title || 'Untitled'}"`,
          details: [`Document ID: ${args.doc_id}`],
        };
      case 'doc_move':
        return {
          title: 'Move Document',
          description: `Move document to ${args.target_folder_id || 'root'}`,
          details: [
            `Document ID: ${args.doc_id}`,
            args.position !== null && args.position !== undefined && `Position: ${args.position}`,
          ].filter(Boolean),
        };
      case 'edit_apply':
        // Log to debug ops structure
        dbg.log('edit_apply args:', {
          args,
          ops: args.ops,
          ops_type: typeof args.ops,
          ops_is_array: Array.isArray(args.ops),
          ops_length: args.ops?.length,
          ops_string: typeof args.ops === 'string' ? args.ops : undefined,
        });
        
        // Handle case where ops might be a JSON string
        let opsArray = args.ops;
        if (typeof args.ops === 'string') {
          try {
            opsArray = JSON.parse(args.ops);
          } catch (e) {
            dbg.warn('Failed to parse ops as JSON:', e);
          }
        }
        
        const opsCount = Array.isArray(opsArray) ? opsArray.length : 0;
        
        return {
          title: 'Apply Changes',
          description: `Apply ${opsCount} edit operation(s) to the document`,
          details: [
            `Document ID: ${args.doc_id}`,
            `Section: ${args.section}`,
            opsCount > 0 && opsCount <= 3 && Array.isArray(opsArray) && opsArray.map((op: any, idx: number) => 
              `Operation ${idx + 1}: ${op.type || 'unknown'}`
            ),
          ].flat().filter(Boolean),
        };
      case 'meta_write':
        return {
          title: 'Update Metadata',
          description: `Update meta field "${args.handle}" to "${args.value}"`,
          details: [],
        };
      case 'clip_create':
        return {
          title: 'Create Clip',
          description: `Create a new clip${args.name ? ` named "${args.name}"` : ''}`,
          details: [
            args.parent_doc_id && `Parent: ${args.parent_doc_id}`,
            args.tags && args.tags.length > 0 && `Tags: ${args.tags.join(', ')}`,
          ].filter(Boolean),
        };
      case 'clip_update':
        return {
          title: 'Update Clip',
          description: `Update clip "${args.clip_id}"`,
          details: [
            args.name && `Name: ${args.name}`,
            args.tags && args.tags.length > 0 && `Tags: ${args.tags.join(', ')}`,
          ].filter(Boolean),
        };
      default:
        return {
          title: toolName,
          description: 'This operation requires your approval',
          details: [JSON.stringify(args, null, 2)],
        };
    }
  };

  const formatted = formatToolCall();

  return (
    <div className="max-w-[85%] rounded-lg px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600/50 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
            {formatted.title}
          </div>
          <div className="text-yellow-800 dark:text-yellow-300 mb-2">
            {formatted.description}
          </div>
          {formatted.details.length > 0 && (
            <div className="text-xs text-yellow-700 dark:text-yellow-400/80 space-y-1 mb-3">
              {formatted.details.map((detail, idx) => (
                <div key={idx}>{detail}</div>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={onApprove}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white rounded-md text-xs font-medium transition-colors"
            >
              <Checkmark size={14} />
              Approve
            </button>
            <button
              onClick={onReject}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-md text-xs font-medium transition-colors"
            >
              <Close size={14} />
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolCallApproval;
