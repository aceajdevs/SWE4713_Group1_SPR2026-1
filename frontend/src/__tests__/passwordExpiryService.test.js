import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the supabase client before importing the service
vi.mock('../supabaseClient', () => {
  const mockSelect = vi.fn();
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  return {
    supabase: {
      from: mockFrom,
      auth: { getUser: vi.fn(), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })) },
    },
    __mockFrom: mockFrom,
    __mockSelect: mockSelect,
  };
});

import { checkPasswordsAboutToExpire } from '../services/passwordExpiryService';
import { __mockFrom, __mockSelect } from '../supabaseClient';

describe('checkPasswordsAboutToExpire', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ══════════════════════════════════════════════
  // POSITIVE TESTS
  // ══════════════════════════════════════════════
  it('returns passwords expiring within the default 3-day window', async () => {
    const now = new Date('2026-03-17T12:00:00Z');
    vi.setSystemTime(now);

    // Expires in 2 days — within the 3-day window
    const expiringDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();

    __mockSelect.mockResolvedValue({
      data: [
        {
          userID: 10,
          passwordExpires: expiringDate,
          passwordExpiryWarningSentAt: null,
          email: 'test@example.com',
          fName: 'Test',
          lName: 'User',
          username: 'testuser',
          status: true,
        },
      ],
      error: null,
    });

    const result = await checkPasswordsAboutToExpire();
    expect(result).toHaveLength(1);
    expect(result[0].userID).toBe(10);
  });

  it('returns passwords expiring within a custom window', async () => {
    const now = new Date('2026-03-17T12:00:00Z');
    vi.setSystemTime(now);

    // Expires in 6 days
    const expiringDate = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString();

    __mockSelect.mockResolvedValue({
      data: [
        {
          userID: 20,
          passwordExpires: expiringDate,
          passwordExpiryWarningSentAt: null,
          email: 'user2@example.com',
          fName: 'User',
          lName: 'Two',
          username: 'user2',
          status: true,
        },
      ],
      error: null,
    });

    // 7-day window should include it
    const result = await checkPasswordsAboutToExpire(7);
    expect(result).toHaveLength(1);
  });

  it('returns multiple expiring passwords', async () => {
    const now = new Date('2026-03-17T12:00:00Z');
    vi.setSystemTime(now);

    const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const inOneDay = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();

    __mockSelect.mockResolvedValue({
      data: [
        {
          userID: 10,
          passwordExpires: inTwoDays,
          passwordExpiryWarningSentAt: null,
          email: 'a@example.com',
          fName: 'A',
          lName: 'A',
          username: 'a',
          status: true,
        },
        {
          userID: 20,
          passwordExpires: inOneDay,
          passwordExpiryWarningSentAt: null,
          email: 'b@example.com',
          fName: 'B',
          lName: 'B',
          username: 'b',
          status: true,
        },
      ],
      error: null,
    });

    const result = await checkPasswordsAboutToExpire(3);
    expect(result).toHaveLength(2);
  });

  // ══════════════════════════════════════════════
  // NEGATIVE / EXCLUSION TESTS
  // ══════════════════════════════════════════════
  it('excludes already-expired passwords', async () => {
    const now = new Date('2026-03-17T12:00:00Z');
    vi.setSystemTime(now);

    // Expired yesterday
    const expiredDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();

    __mockSelect.mockResolvedValue({
      data: [
        {
          userID: 10,
          passwordExpires: expiredDate,
          passwordExpiryWarningSentAt: null,
          email: 'x@example.com',
          fName: 'X',
          lName: 'X',
          username: 'x',
          status: true,
        },
      ],
      error: null,
    });

    const result = await checkPasswordsAboutToExpire(3);
    expect(result).toHaveLength(0);
  });

  it('excludes passwords expiring beyond the window', async () => {
    const now = new Date('2026-03-17T12:00:00Z');
    vi.setSystemTime(now);

    // Expires in 10 days — outside the 3-day window
    const farDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();

    __mockSelect.mockResolvedValue({
      data: [
        {
          userID: 10,
          passwordExpires: farDate,
          passwordExpiryWarningSentAt: null,
          email: 'x@example.com',
          fName: 'X',
          lName: 'X',
          username: 'x',
          status: true,
        },
      ],
      error: null,
    });

    const result = await checkPasswordsAboutToExpire(3);
    expect(result).toHaveLength(0);
  });

  it('skips rows with null activeTill', async () => {
    const now = new Date('2026-03-17T12:00:00Z');
    vi.setSystemTime(now);

    __mockSelect.mockResolvedValue({
      data: [
        {
          userID: 10,
          passwordExpires: null,
          passwordExpiryWarningSentAt: null,
          email: 'x@example.com',
          fName: 'X',
          lName: 'X',
          username: 'x',
          status: true,
        },
      ],
      error: null,
    });

    const result = await checkPasswordsAboutToExpire(3);
    expect(result).toHaveLength(0);
  });

  // ══════════════════════════════════════════════
  // EDGE CASES
  // ══════════════════════════════════════════════
  it('returns empty array when no data is returned', async () => {
    __mockSelect.mockResolvedValue({ data: [], error: null });
    const result = await checkPasswordsAboutToExpire();
    expect(result).toEqual([]);
  });

  it('returns empty array when data is null', async () => {
    __mockSelect.mockResolvedValue({ data: null, error: null });
    const result = await checkPasswordsAboutToExpire();
    expect(result).toEqual([]);
  });

  it('returns empty array on supabase error', async () => {
    __mockSelect.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const result = await checkPasswordsAboutToExpire();
    expect(result).toEqual([]);
  });

  it('returns empty array on unexpected exception', async () => {
    __mockSelect.mockRejectedValue(new Error('Network failure'));
    const result = await checkPasswordsAboutToExpire();
    expect(result).toEqual([]);
  });

  // Boundary: password expiring at exactly the window edge
  it('includes password expiring at exactly the boundary (3 days)', async () => {
    const now = new Date('2026-03-17T12:00:00Z');
    vi.setSystemTime(now);

    // Expires at exactly 3 days minus 1 ms
    const almostThreeDays = new Date(
      now.getTime() + 3 * 24 * 60 * 60 * 1000 - 1
    ).toISOString();

    __mockSelect.mockResolvedValue({
      data: [
        {
          userID: 10,
          passwordExpires: almostThreeDays,
          passwordExpiryWarningSentAt: null,
          email: 'x@example.com',
          fName: 'X',
          lName: 'X',
          username: 'x',
          status: true,
        },
      ],
      error: null,
    });

    const result = await checkPasswordsAboutToExpire(3);
    expect(result).toHaveLength(1);
  });

  // Boundary: password expiring in 1 millisecond (about to expire right now)
  it('includes password expiring in 1ms (imminent)', async () => {
    const now = new Date('2026-03-17T12:00:00Z');
    vi.setSystemTime(now);

    const almostNow = new Date(now.getTime() + 1).toISOString();

    __mockSelect.mockResolvedValue({
      data: [
        {
          userID: 10,
          passwordExpires: almostNow,
          passwordExpiryWarningSentAt: null,
          email: 'x@example.com',
          fName: 'X',
          lName: 'X',
          username: 'x',
          status: true,
        },
      ],
      error: null,
    });

    const result = await checkPasswordsAboutToExpire(3);
    expect(result).toHaveLength(1);
  });

  it('calls supabase with the correct table', async () => {
    __mockSelect.mockResolvedValue({ data: [], error: null });
    await checkPasswordsAboutToExpire();
    expect(__mockFrom).toHaveBeenCalledWith('user');
  });
});
