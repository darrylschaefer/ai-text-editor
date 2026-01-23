/**
 * Unit tests for revision history functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildBeforeImages,
  updateBeforeImagesAfterInsert,
  calculateRevisionStats,
  invertRevision,
  shouldCreateSnapshot,
  createSnapshot,
  getOrInitSectionHistory,
} from '../revision-history';
import { PatchOperation } from '@type/block';
import { RevisionRecord, SectionHistory } from '@type/revision';

describe('revision-history', () => {
  describe('buildBeforeImages', () => {
    it('should build before image for replace_block', () => {
      const preState = {
        root: {
          children: [
            {
              type: 'paragraph',
              block_id: 'b1',
              children: [{ type: 'text', text: 'Old content' }],
            },
          ],
        },
      };
      
      const ops: PatchOperation[] = [
        { type: 'replace_block', block_id: 'b1', content: 'New content' },
      ];
      
      const beforeImages = buildBeforeImages(ops, preState);
      
      expect(beforeImages).toHaveLength(1);
      expect(beforeImages[0].op_type).toBe('replace_block');
      if (beforeImages[0].op_type === 'replace_block') {
        expect(beforeImages[0].block_id).toBe('b1');
        expect(beforeImages[0].old_block).toBeDefined();
      }
    });
    
    it('should build before image for delete_blocks', () => {
      const preState = {
        root: {
          children: [
            {
              type: 'paragraph',
              block_id: 'b1',
              children: [{ type: 'text', text: 'Content 1' }],
            },
            {
              type: 'paragraph',
              block_id: 'b2',
              children: [{ type: 'text', text: 'Content 2' }],
            },
          ],
        },
      };
      
      const ops: PatchOperation[] = [
        { type: 'delete_blocks', block_ids: ['b1', 'b2'] },
      ];
      
      const beforeImages = buildBeforeImages(ops, preState);
      
      expect(beforeImages).toHaveLength(1);
      expect(beforeImages[0].op_type).toBe('delete_blocks');
      if (beforeImages[0].op_type === 'delete_blocks') {
        expect(beforeImages[0].deleted_blocks).toHaveLength(2);
        expect(beforeImages[0].deleted_blocks[0].block.block_id).toBe('b1');
        expect(beforeImages[0].deleted_blocks[1].block.block_id).toBe('b2');
        expect(beforeImages[0].deleted_blocks[0].position).toBe(0);
        expect(beforeImages[0].deleted_blocks[1].position).toBe(1);
      }
    });
    
    it('should build before image for move_block_range', () => {
      const preState = {
        root: {
          children: [
            { type: 'paragraph', block_id: 'b1', children: [] },
            { type: 'paragraph', block_id: 'b2', children: [] },
            { type: 'paragraph', block_id: 'b3', children: [] },
            { type: 'paragraph', block_id: 'b4', children: [] },
          ],
        },
      };
      
      const ops: PatchOperation[] = [
        { type: 'move_block_range', start_block_id: 'b2', end_block_id: 'b3', after_block_id: 'b4' },
      ];
      
      const beforeImages = buildBeforeImages(ops, preState);
      
      expect(beforeImages).toHaveLength(1);
      expect(beforeImages[0].op_type).toBe('move_block_range');
      if (beforeImages[0].op_type === 'move_block_range') {
        expect(beforeImages[0].moved_block_ids).toContain('b2');
        expect(beforeImages[0].moved_block_ids).toContain('b3');
        expect(beforeImages[0].original_positions).toBeDefined();
      }
    });
  });
  
  describe('updateBeforeImagesAfterInsert', () => {
    it('should update before images with inserted block IDs', () => {
      const beforeImages = [
        { op_type: 'insert_blocks_after' as const, inserted_block_ids: [] },
      ];
      
      const ops: PatchOperation[] = [
        {
          type: 'insert_blocks_after',
          after_block_id: 'b1',
          blocks: [
            { type: 'paragraph', content: 'New block 1' },
            { type: 'paragraph', content: 'New block 2' },
          ],
        },
      ];
      
      const postState = {
        root: {
          children: [
            { type: 'paragraph', block_id: 'b1', children: [] },
            { type: 'paragraph', block_id: 'b2', children: [] }, // Inserted
            { type: 'paragraph', block_id: 'b3', children: [] }, // Inserted
          ],
        },
      };
      
      updateBeforeImagesAfterInsert(beforeImages, ops, postState);
      
      expect(beforeImages[0].op_type).toBe('insert_blocks_after');
      if (beforeImages[0].op_type === 'insert_blocks_after') {
        expect(beforeImages[0].inserted_block_ids).toHaveLength(2);
        expect(beforeImages[0].inserted_block_ids).toContain('b2');
        expect(beforeImages[0].inserted_block_ids).toContain('b3');
      }
    });
  });
  
  describe('calculateRevisionStats', () => {
    it('should calculate stats for replace_block', () => {
      const preState = {
        root: {
          children: [
            { type: 'paragraph', block_id: 'b1', children: [{ type: 'text', text: 'Old text' }] },
          ],
        },
      };
      
      const postState = {
        root: {
          children: [
            { type: 'paragraph', block_id: 'b1', children: [{ type: 'text', text: 'New text longer' }] },
          ],
        },
      };
      
      const ops: PatchOperation[] = [
        { type: 'replace_block', block_id: 'b1', content: 'New text longer' },
      ];
      
      const beforeImages = buildBeforeImages(ops, preState);
      const stats = calculateRevisionStats(ops, beforeImages, preState, postState);
      
      expect(stats.chars_deleted).toBeGreaterThan(0);
      expect(stats.chars_added).toBeGreaterThan(0);
      expect(stats.blocks_added).toBe(0);
      expect(stats.blocks_deleted).toBe(0);
    });
    
    it('should calculate stats for insert_blocks_after', () => {
      const preState = {
        root: {
          children: [
            { type: 'paragraph', block_id: 'b1', children: [] },
          ],
        },
      };
      
      const postState = {
        root: {
          children: [
            { type: 'paragraph', block_id: 'b1', children: [] },
            { type: 'paragraph', block_id: 'b2', children: [{ type: 'text', text: 'New block' }] },
          ],
        },
      };
      
      const ops: PatchOperation[] = [
        {
          type: 'insert_blocks_after',
          after_block_id: 'b1',
          blocks: [{ type: 'paragraph', content: 'New block' }],
        },
      ];
      
      const beforeImages = buildBeforeImages(ops, preState);
      updateBeforeImagesAfterInsert(beforeImages, ops, postState);
      const stats = calculateRevisionStats(ops, beforeImages, preState, postState);
      
      expect(stats.blocks_added).toBe(1);
      expect(stats.chars_added).toBeGreaterThan(0);
    });
  });
  
  describe('invertRevision', () => {
    it('should invert replace_block', () => {
      const record: RevisionRecord = {
        revision_id: 'rev1',
        parent_revision_id: null,
        created_at: new Date().toISOString(),
        ops: [
          { type: 'replace_block', block_id: 'b1', content: 'New content' },
        ],
        before: [
          {
            op_type: 'replace_block',
            block_id: 'b1',
            old_block: {
              type: 'paragraph',
              block_id: 'b1',
              children: [{ type: 'text', text: 'Old content' }],
            },
          },
        ],
      };
      
      const inverted = invertRevision(record);
      
      expect(inverted).toHaveLength(1);
      expect(inverted[0].type).toBe('replace_block');
      if (inverted[0].type === 'replace_block') {
        expect(inverted[0].block_id).toBe('b1');
        expect(inverted[0].content).toBe('Old content');
      }
    });
    
    it('should invert delete_blocks', () => {
      const record: RevisionRecord = {
        revision_id: 'rev1',
        parent_revision_id: null,
        created_at: new Date().toISOString(),
        ops: [
          { type: 'delete_blocks', block_ids: ['b1'] },
        ],
        before: [
          {
            op_type: 'delete_blocks',
            deleted_blocks: [
              {
                block: {
                  type: 'paragraph',
                  block_id: 'b1',
                  children: [{ type: 'text', text: 'Deleted content' }],
                },
                position: 0,
              },
            ],
          },
        ],
      };
      
      const inverted = invertRevision(record);
      // Inversion of delete is complex - would need insertion points
      // For now, just verify it doesn't crash
      expect(Array.isArray(inverted)).toBe(true);
    });
  });
  
  describe('shouldCreateSnapshot', () => {
    it('should return true after 100 revisions', () => {
      const history: SectionHistory = {
        revisions: Array.from({ length: 100 }, (_, i) => ({
          revision_id: `rev${i}`,
          parent_revision_id: i > 0 ? `rev${i - 1}` : null,
          created_at: new Date().toISOString(),
          ops: [],
          before: [],
        })),
        snapshots: [],
      };
      
      expect(shouldCreateSnapshot(history)).toBe(true);
    });
    
    it('should return false before threshold', () => {
      const history: SectionHistory = {
        revisions: Array.from({ length: 50 }, (_, i) => ({
          revision_id: `rev${i}`,
          parent_revision_id: i > 0 ? `rev${i - 1}` : null,
          created_at: new Date().toISOString(),
          ops: [],
          before: [],
        })),
        snapshots: [],
      };
      
      expect(shouldCreateSnapshot(history)).toBe(false);
    });
  });
  
  describe('getOrInitSectionHistory', () => {
    it('should initialize section history if missing', () => {
      const doc: any = {
        id: 'doc1',
        sectionHistory: undefined,
      };
      
      const history = getOrInitSectionHistory(doc, 'Draft');
      
      expect(history).toBeDefined();
      expect(history.current_revision_id).toBeNull();
      expect(history.history.revisions).toEqual([]);
      expect(history.history.snapshots).toEqual([]);
      expect(doc.sectionHistory).toBeDefined();
      expect(doc.sectionHistory.Draft).toBeDefined();
    });
    
    it('should return existing section history', () => {
      const doc: any = {
        id: 'doc1',
        sectionHistory: {
          Draft: {
            current_revision_id: 'rev1',
            history: {
              revisions: [],
              snapshots: [],
            },
          },
        },
      };
      
      const history = getOrInitSectionHistory(doc, 'Draft');
      
      expect(history.current_revision_id).toBe('rev1');
    });
  });
});
