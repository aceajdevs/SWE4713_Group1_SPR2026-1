import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRpc = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockSendAdminEmail = vi.fn();

vi.mock('../supabaseClient', () => ({
  supabase: {
    rpc: (...args) => mockRpc(...args),
    from: (...args) => mockFrom(...args),
  },
}));

vi.mock('../services/emailService', () => ({
  sendAdminEmail: (...args) => mockSendAdminEmail(...args),
  sendNewAccountRequest: vi.fn(),
}));

import { approveUserRequest } from '../services/userService';

describe('approveUserRequest approval email notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends approval email using user record after approval', async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: [{ userID: 88, email: 'requestor@example.com' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ userID: 42 }],
        error: null,
      });

    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        email: 'approved@example.com',
        fName: 'New',
        lName: 'User',
        username: 'new.user',
      },
      error: null,
    });
    mockSendAdminEmail.mockResolvedValueOnce(true);

    const result = await approveUserRequest(88, 'accountant', 1);

    expect(result.accountCreationEmailSent).toBe(true);
    expect(mockSendAdminEmail).toHaveBeenCalledWith(
      'approved@example.com',
      'New User',
      'Your account request was approved',
      expect.stringContaining('new.user')
    );
  });

  it('falls back to request email when post-approval user lookup is empty', async () => {
    mockRpc
      .mockResolvedValueOnce({
        data: [
          {
            userID: 55,
            email: 'pending@example.com',
            fName: 'Pending',
            lName: 'Person',
            username: 'pending.person',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ userID: 999 }],
        error: null,
      });

    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockSendAdminEmail.mockResolvedValueOnce(true);

    const result = await approveUserRequest(55, 'manager', 2);

    expect(result.accountCreationEmailSent).toBe(true);
    expect(mockSendAdminEmail).toHaveBeenCalledWith(
      'pending@example.com',
      'pending.person',
      'Your account request was approved',
      expect.stringContaining('pending.person')
    );
  });
});
