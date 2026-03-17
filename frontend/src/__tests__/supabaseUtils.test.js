import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Chainable mock builder ─────────────────────
function chain(resolvedValue) {
  const c = {
    select: vi.fn(() => c),
    order: vi.fn(() => c),
    limit: vi.fn(() => c),
    eq: vi.fn(() => c),
    insert: vi.fn(() => c),
    update: vi.fn(() => c),
    delete: vi.fn(() => c),
  };
  const p = Promise.resolve(resolvedValue);
  c.then = p.then.bind(p);
  c.catch = p.catch.bind(p);
  return c;
}

let latestChain;
let mockUpload;
let mockGetPublicUrl;
let mockChannel;

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => latestChain),
    storage: {
      from: vi.fn(() => ({
        upload: (...args) => mockUpload(...args),
        getPublicUrl: (...args) => mockGetPublicUrl(...args),
      })),
    },
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

import {
  fetchFromTable,
  insertRecord,
  updateRecord,
  deleteRecord,
  uploadFile,
  getFileUrl,
  subscribeToTable,
} from '../supabaseUtils';
import { supabase } from '../supabaseClient';

describe('supabaseUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload = vi.fn();
    mockGetPublicUrl = vi.fn();
  });

  // ══════════════════════════════════════════════
  // fetchFromTable
  // ══════════════════════════════════════════════
  describe('fetchFromTable', () => {
    it('fetches all records from a table', async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      latestChain = chain({ data: rows, error: null });

      const result = await fetchFromTable('accounts');
      expect(result.data).toEqual(rows);
      expect(result.error).toBeNull();
      expect(supabase.from).toHaveBeenCalledWith('accounts');
    });

    it('applies filters when provided', async () => {
      latestChain = chain({ data: [{ id: 1 }], error: null });

      await fetchFromTable('accounts', { filters: { status: 'active' } });
      expect(latestChain.eq).toHaveBeenCalledWith('status', 'active');
    });

    it('applies orderBy when provided', async () => {
      latestChain = chain({ data: [], error: null });

      await fetchFromTable('accounts', {
        orderBy: { column: 'createdAt', ascending: false },
      });
      expect(latestChain.order).toHaveBeenCalledWith('createdAt', { ascending: false });
    });

    it('applies limit when provided', async () => {
      latestChain = chain({ data: [], error: null });

      await fetchFromTable('accounts', { limit: 10 });
      expect(latestChain.limit).toHaveBeenCalledWith(10);
    });

    it('returns error object on failure', async () => {
      latestChain = chain({ data: null, error: { message: 'oops' } });

      const result = await fetchFromTable('accounts');
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('uses custom select when provided', async () => {
      latestChain = chain({ data: [], error: null });

      await fetchFromTable('accounts', { select: 'id, name' });
      expect(latestChain.select).toHaveBeenCalledWith('id, name');
    });

    it('defaults to select * when no select option', async () => {
      latestChain = chain({ data: [], error: null });

      await fetchFromTable('accounts');
      expect(latestChain.select).toHaveBeenCalledWith('*');
    });
  });

  // ══════════════════════════════════════════════
  // insertRecord
  // ══════════════════════════════════════════════
  describe('insertRecord', () => {
    it('inserts a record and returns it', async () => {
      const newRecord = { id: 3, name: 'Test' };
      latestChain = chain({ data: [newRecord], error: null });

      const result = await insertRecord('accounts', { name: 'Test' });
      expect(result.data).toEqual(newRecord);
      expect(result.error).toBeNull();
    });

    it('returns error on failure', async () => {
      latestChain = chain({ data: null, error: { message: 'duplicate key' } });

      const result = await insertRecord('accounts', { name: 'Test' });
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
    });

    it('handles null data array gracefully', async () => {
      latestChain = chain({ data: null, error: null });

      const result = await insertRecord('accounts', { name: 'Test' });
      // data?.[0] → undefined
      expect(result.data).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════
  // updateRecord
  // ══════════════════════════════════════════════
  describe('updateRecord', () => {
    it('updates a record and returns it', async () => {
      const updated = { id: 1, name: 'Updated' };
      latestChain = chain({ data: [updated], error: null });

      const result = await updateRecord('accounts', 1, { name: 'Updated' });
      expect(result.data).toEqual(updated);
      expect(result.error).toBeNull();
    });

    it('returns error on failure', async () => {
      latestChain = chain({ data: null, error: { message: 'not found' } });

      const result = await updateRecord('accounts', 999, { name: 'Nope' });
      expect(result.error).toBeTruthy();
    });
  });

  // ══════════════════════════════════════════════
  // deleteRecord
  // ══════════════════════════════════════════════
  describe('deleteRecord', () => {
    it('deletes a record successfully', async () => {
      latestChain = chain({ error: null });

      const result = await deleteRecord('accounts', 1);
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('returns failure on error', async () => {
      latestChain = chain({ error: { message: 'FK constraint' } });

      const result = await deleteRecord('accounts', 1);
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  // ══════════════════════════════════════════════
  // uploadFile
  // ══════════════════════════════════════════════
  describe('uploadFile', () => {
    it('uploads a file successfully', async () => {
      mockUpload.mockResolvedValue({ data: { path: 'avatars/pic.png' }, error: null });

      const result = await uploadFile('avatars', 'pic.png', new Blob(['data']));
      expect(result.data).toEqual({ path: 'avatars/pic.png' });
      expect(result.error).toBeNull();
    });

    it('returns error on upload failure', async () => {
      mockUpload.mockResolvedValue({ data: null, error: { message: 'too large' } });

      const result = await uploadFile('avatars', 'pic.png', new Blob(['data']));
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  // ══════════════════════════════════════════════
  // getFileUrl
  // ══════════════════════════════════════════════
  describe('getFileUrl', () => {
    it('returns the public URL', () => {
      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/avatars/pic.png' },
      });

      const url = getFileUrl('avatars', 'pic.png');
      expect(url).toBe('https://example.com/avatars/pic.png');
    });

    it('returns null when no public URL', () => {
      mockGetPublicUrl.mockReturnValue({ data: null });

      const url = getFileUrl('avatars', 'nonexistent.png');
      expect(url).toBeNull();
    });
  });

  // ══════════════════════════════════════════════
  // subscribeToTable
  // ══════════════════════════════════════════════
  describe('subscribeToTable', () => {
    it('returns an unsubscribe function', () => {
      mockChannel = {
        on: vi.fn(() => mockChannel),
        subscribe: vi.fn(() => mockChannel),
      };

      const unsubscribe = subscribeToTable('accounts', vi.fn());
      expect(typeof unsubscribe).toBe('function');
      expect(mockChannel.on).toHaveBeenCalled();
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('calls removeChannel when unsubscribed', () => {
      mockChannel = {
        on: vi.fn(() => mockChannel),
        subscribe: vi.fn(() => mockChannel),
      };

      const unsubscribe = subscribeToTable('accounts', vi.fn());
      unsubscribe();
      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
  });
});
