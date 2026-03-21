import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();

vi.mock('../supabaseClient', () => ({
  supabase: {
    rpc: (...args) => mockRpc(...args),
    auth: {
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

import {
  createChartAccountWithActor,
  updateChartAccountWithActor,
  setChartAccountActiveWithActor,
} from '../services/chartOfAccountsService';

const sampleAccount = {
  accountName: 'Cash',
  accountNumber: 10000001,
  description: 'Main cash account',
  normalSide: 'Debit',
  type: 'Assets',
  subType: 'Current Assets',
  orderNumber: 1,
  initBalance: 5000,
  active: true,
  statementType: 'Balance Sheet',
};

describe('chartOfAccountsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // createChartAccountWithActor
  describe('createChartAccountWithActor', () => {
    it('calls the correct RPC with all parameters', async () => {
      mockRpc.mockResolvedValue({ data: { accountID: 1 }, error: null });

      await createChartAccountWithActor(sampleAccount, 42);

      expect(mockRpc).toHaveBeenCalledWith('create_chart_account_with_actor', {
        p_account_name: 'Cash',
        p_account_number: 10000001,
        p_description: 'Main cash account',
        p_normal_side: 'Debit',
        p_type: 'Assets',
        p_sub_type: 'Current Assets',
        p_order_number: 1,
        p_init_balance: 5000,
        p_active: true,
        p_statement_type: 'Balance Sheet',
        p_actor_userid: 42,
      });
    });

    it('returns data on success', async () => {
      mockRpc.mockResolvedValue({ data: { accountID: 1 }, error: null });

      const result = await createChartAccountWithActor(sampleAccount, 42);
      expect(result).toEqual({ accountID: 1 });
    });

    it('throws on Supabase error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'duplicate key' } });

      await expect(createChartAccountWithActor(sampleAccount, 42)).rejects.toEqual({
        message: 'duplicate key',
      });
    });

    it('defaults null for optional fields when undefined', async () => {
      mockRpc.mockResolvedValue({ data: { accountID: 2 }, error: null });

      const minimalAccount = {
        accountName: 'Test',
        accountNumber: 20000001,
      };

      await createChartAccountWithActor(minimalAccount, 1);

      const args = mockRpc.mock.calls[0][1];
      expect(args.p_description).toBeNull();
      expect(args.p_normal_side).toBeNull();
      expect(args.p_type).toBeNull();
      expect(args.p_sub_type).toBeNull();
      expect(args.p_order_number).toBeNull();
      expect(args.p_init_balance).toBeNull();
      expect(args.p_statement_type).toBeNull();
    });

    it('defaults active to true when not provided', async () => {
      mockRpc.mockResolvedValue({ data: { accountID: 3 }, error: null });

      const noActiveField = { accountName: 'Test', accountNumber: 30000001 };
      await createChartAccountWithActor(noActiveField, 1);

      const args = mockRpc.mock.calls[0][1];
      expect(args.p_active).toBe(true);
    });
  });

  // updateChartAccountWithActor
  describe('updateChartAccountWithActor', () => {
    it('calls the correct RPC with account ID', async () => {
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      await updateChartAccountWithActor(99, sampleAccount, 42);

      expect(mockRpc).toHaveBeenCalledWith(
        'update_chart_account_with_actor',
        expect.objectContaining({
          p_account_id: 99,
          p_account_name: 'Cash',
          p_actor_userid: 42,
        })
      );
    });

    it('returns data on success', async () => {
      mockRpc.mockResolvedValue({ data: { updated: true }, error: null });

      const result = await updateChartAccountWithActor(1, sampleAccount, 42);
      expect(result).toEqual({ updated: true });
    });

    it('throws on error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'not found' } });

      await expect(updateChartAccountWithActor(999, sampleAccount, 42)).rejects.toEqual({
        message: 'not found',
      });
    });
  });

  // setChartAccountActiveWithActor
  describe('setChartAccountActiveWithActor', () => {
    it('calls RPC to deactivate an account', async () => {
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      await setChartAccountActiveWithActor(5, false, 42);

      expect(mockRpc).toHaveBeenCalledWith('set_chart_account_active_with_actor', {
        p_account_id: 5,
        p_active: false,
        p_actor_userid: 42,
      });
    });

    it('calls RPC to activate an account', async () => {
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      await setChartAccountActiveWithActor(5, true, 42);

      const args = mockRpc.mock.calls[0][1];
      expect(args.p_active).toBe(true);
    });

    it('returns data on success', async () => {
      mockRpc.mockResolvedValue({ data: { done: true }, error: null });

      const result = await setChartAccountActiveWithActor(5, false, 42);
      expect(result).toEqual({ done: true });
    });

    it('throws on error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'balance greater than zero' },
      });

      await expect(setChartAccountActiveWithActor(5, false, 42)).rejects.toEqual({
        message: 'balance greater than zero',
      });
    });
  });
});
