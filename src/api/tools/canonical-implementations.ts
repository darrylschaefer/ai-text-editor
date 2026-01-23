/**
 * Canonical tool implementations (snake_case)
 * These wrap or adapt legacy implementations to provide consistent interfaces
 */

import { ToolContext } from './context';
import { readMeta, writeMeta } from './implementations';
import { readSelectionTool } from './selection-tools';
import { snippetListTool, snippetReadTool, snippetCreateTool, snippetUpdateTool } from './snippet-tools';

/**
 * read_meta implementation (canonical)
 */
export async function readMetaTool(
  args: { handle: string },
  ctx?: ToolContext
): Promise<{ success: boolean; value?: string; error?: string }> {
  try {
    const result = await readMeta(args);
    
    // Check if result is an error message
    if (result.startsWith('Error:') || result.includes('not found') || result.includes('does not exist')) {
      return {
        success: false,
        error: result,
      };
    }
    
    return {
      success: true,
      value: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * write_meta implementation (canonical)
 */
export async function writeMetaTool(
  args: { handle: string; value: string },
  ctx?: ToolContext
): Promise<string> {
  try {
    const result = await writeMeta({ handle: args.handle, value: args.value });
    
    if (result.startsWith('Error:')) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'execution_error',
          message: result,
        },
      });
    }
    
    return JSON.stringify({
      ok: true,
      message: result,
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: {
        code: 'execution_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * Export canonical implementations
 */
export {
  readSelectionTool as readSelectionToolCanonical,
  snippetListTool,
  snippetReadTool,
  snippetCreateTool,
  snippetUpdateTool,
};
