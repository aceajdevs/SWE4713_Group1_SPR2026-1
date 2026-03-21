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

// Mock hashPassword and hashSecurityAnswer so tests don't need real crypto
vi.mock('../utils/passwordHash', () => ({
  hashPassword: vi.fn((pw) => Promise.resolve(`hashed_${pw}`)),
}));

vi.mock('../utils/securityAnswerHash', () => ({
  hashSecurityAnswer: vi.fn((a) => Promise.resolve(a ? `hashed_${a}` : null)),
}));

// Mock emailService
vi.mock('../services/emailService', () => ({
  sendNewAccountRequest: vi.fn(() => Promise.resolve()),
}));

import {
  createUser,
  admin_createUser,
  createUserRequest,
  getSecurityQuestions,
  updateUser,
  getPasswords,
  getUser,
  checkEmail,
  getUserSecurityQuestions,
  verifySecurityAnswers,
  isPasswordReused,
  updateUserPassword,
  adminUpdateUserSecurityAnswers,
  getAllUserRequests,
  approveUserRequest,
  rejectUserRequest,
} from '../services/userService';
import { sendNewAccountRequest } from '../services/emailService';
describe('userService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // createUser
  describe('createUser', () => {
    it('calls RPC with hashed password and returns data', async () => {
      mockRpc.mockResolvedValue({ data: { userID: 1 }, error: null });

      const result = await createUser(
        'a@b.com', 'Alice', 'Smith', '123 St', '2000-01-01', 'Pass1!', 'accountant'
      );

      expect(mockRpc).toHaveBeenCalledWith(
        'create_user_with_actor',
        expect.objectContaining({
          p_email: 'a@b.com',
          p_password: 'hashed_Pass1!',
          p_role: 'accountant',
        })
      );
      expect(result).toEqual({ userID: 1 });
    });

    it('hashes security answers when provided', async () => {
      mockRpc.mockResolvedValue({ data: { userID: 2 }, error: null });

      await createUser(
        'a@b.com', 'A', 'B', '', '', 'Pass1!', 'manager',
        1, 'Fluffy', 2, 'Blue', 3, 'Pizza'
      );

      const args = mockRpc.mock.calls[0][1];
      expect(args.p_secanswer1).toBe('hashed_Fluffy');
      expect(args.p_secanswer2).toBe('hashed_Blue');
      expect(args.p_secanswer3).toBe('hashed_Pizza');
    });

    it('passes null for optional security answers', async () => {
      mockRpc.mockResolvedValue({ data: { userID: 3 }, error: null });

      await createUser('a@b.com', 'A', 'B', '', '', 'Pass1!', 'accountant');

      const args = mockRpc.mock.calls[0][1];
      expect(args.p_questionid1).toBeNull();
      expect(args.p_secanswer1).toBeNull();
    });

    it('throws on Supabase RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'duplicate email' } });

      await expect(
        createUser('a@b.com', 'A', 'B', '', '', 'Pass1!', 'accountant')
      ).rejects.toEqual({ message: 'duplicate email' });
    });
  });

  // admin_createUser
  describe('admin_createUser', () => {
    it('calls RPC with changedByUserId', async () => {
      mockRpc.mockResolvedValue({ data: { userID: 10 }, error: null });

      await admin_createUser(
        'b@c.com', 'Bob', 'Jones', '', '', 'Pass2!', 'manager',
        1, 'ans1', 2, 'ans2', 3, 'ans3', 42
      );

      const args = mockRpc.mock.calls[0][1];
      expect(args.p_changed_by).toBe(42);
      expect(args.p_email).toBe('b@c.com');
    });

    it('throws on error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } });

      await expect(
        admin_createUser('b@c.com', 'B', 'J', '', '', 'P!', 'manager', 1, 'a', 2, 'b', 3, 'c', 1)
      ).rejects.toEqual({ message: 'forbidden' });
    });
  });

  // createUserRequest
  describe('createUserRequest', () => {
    it('creates request and sends notification email', async () => {
      mockRpc.mockResolvedValue({ data: { requestID: 1 }, error: null });

      const result = await createUserRequest(
        'c@d.com', 'Carol', 'Doe', '456 Ave', '1995-06-15', 'Pass3!',
        1, 'ans1', 2, 'ans2', 3, 'ans3'
      );

      expect(mockRpc).toHaveBeenCalledWith(
        'create_user_request',
        expect.objectContaining({ p_email: 'c@d.com' })
      );
      expect(sendNewAccountRequest).toHaveBeenCalledWith('Carol Doe');
      expect(result).toEqual({ requestID: 1 });
    });

    it('still returns data even if email fails', async () => {
      mockRpc.mockResolvedValue({ data: { requestID: 2 }, error: null });
      sendNewAccountRequest.mockRejectedValueOnce(new Error('SMTP down'));

      const result = await createUserRequest(
        'c@d.com', 'Carol', 'Doe', '', '', 'Pass3!',
        1, 'a', 2, 'b', 3, 'c'
      );

      expect(result).toEqual({ requestID: 2 });
    });

    it('throws when RPC fails', async () => {
      mockRpc.mockRejectedValue(new Error('DB down'));

      await expect(
        createUserRequest('c@d.com', 'C', 'D', '', '', 'P!', 1, 'a', 2, 'b', 3, 'c')
      ).rejects.toThrow('DB down');
    });
  });

  // getSecurityQuestions
  describe('getSecurityQuestions', () => {
    it('returns questions array', async () => {
      const questions = [{ questionID: 1, question: 'Pet name?' }];
      mockRpc.mockResolvedValue({ data: questions, error: null });

      const result = await getSecurityQuestions();
      expect(result).toEqual(questions);
      expect(mockRpc).toHaveBeenCalledWith('get_securityquestions');
    });

    it('returns empty array when data is null', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await getSecurityQuestions();
      expect(result).toEqual([]);
    });

    it('throws on error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } });

      await expect(getSecurityQuestions()).rejects.toEqual({ message: 'RPC error' });
    });
  });

  // updateUser
  describe('updateUser', () => {
    it('calls RPC with all fields', async () => {
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      await updateUser({ userId: 1, email: 'new@test.com', fName: 'New', role: 'manager' });

      const args = mockRpc.mock.calls[0][1];
      expect(args.p_userid).toBe(1);
      expect(args.p_email).toBe('new@test.com');
      expect(args.p_fname).toBe('New');
      expect(args.p_role).toBe('manager');
    });

    it('throws when userId is null', async () => {
      await expect(updateUser({ userId: null })).rejects.toThrow('updateUser: userId is required');
    });

    it('throws when userId is undefined', async () => {
      await expect(updateUser({})).rejects.toThrow('updateUser: userId is required');
    });

    it('converts boolean status correctly', async () => {
      mockRpc.mockResolvedValue({ data: {}, error: null });

      await updateUser({ userId: 1, status: false });
      expect(mockRpc.mock.calls[0][1].p_status).toBe(false);

      await updateUser({ userId: 2, status: true });
      expect(mockRpc.mock.calls[1][1].p_status).toBe(true);
    });

    it('sends null for non-boolean status', async () => {
      mockRpc.mockResolvedValue({ data: {}, error: null });

      await updateUser({ userId: 1, status: 'active' });
      expect(mockRpc.mock.calls[0][1].p_status).toBeNull();
    });

    it('throws on RPC error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'update failed' } });

      await expect(updateUser({ userId: 1 })).rejects.toEqual({ message: 'update failed' });
    });
  });

  // getUser
  describe('getUser', () => {
    it('returns user data', async () => {
      mockRpc.mockResolvedValue({ data: { userID: 5, fName: 'Eve' }, error: null });

      const result = await getUser(5);
      expect(result).toEqual({ userID: 5, fName: 'Eve' });
      expect(mockRpc).toHaveBeenCalledWith('get_user', { p_userid: 5 });
    });

    it('throws on error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'not found' } });

      await expect(getUser(999)).rejects.toEqual({ message: 'not found' });
    });
  });

  // checkEmail
  describe('checkEmail', () => {
    it('returns true when email exists', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });

      const result = await checkEmail('exists@test.com');
      expect(result).toBe(true);
    });

    it('returns false when email does not exist', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null });

      const result = await checkEmail('nope@test.com');
      expect(result).toBe(false);
    });

    it('returns false on error (does not throw)', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      const result = await checkEmail('err@test.com');
      expect(result).toBe(false);
    });
  });

  // getUserSecurityQuestions
  describe('getUserSecurityQuestions', () => {
    it('returns questions for a user', async () => {
      const qs = [{ question: 'Pet name?' }];
      mockRpc.mockResolvedValue({ data: qs, error: null });

      const result = await getUserSecurityQuestions('a@b.com', '5');
      expect(result).toEqual(qs);
      expect(mockRpc).toHaveBeenCalledWith('get_user_security_questions', {
        p_email: 'a@b.com',
        p_userid: 5,
      });
    });

    it('parses userId string to int', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null });

      await getUserSecurityQuestions('a@b.com', '42');
      expect(mockRpc.mock.calls[0][1].p_userid).toBe(42);
    });

    it('throws on error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'no user' } });

      await expect(getUserSecurityQuestions('a@b.com', '1')).rejects.toEqual({
        message: 'no user',
      });
    });
  });

  // verifySecurityAnswers
  describe('verifySecurityAnswers', () => {
    it('returns true when answers match', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });

      const result = await verifySecurityAnswers('a@b.com', '1', 'Fluffy', 'Blue', 'Pizza');
      expect(result).toBe(true);
    });

    it('hashes all three answers before sending', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });

      await verifySecurityAnswers('a@b.com', '1', 'a1', 'a2', 'a3');

      const args = mockRpc.mock.calls[0][1];
      expect(args.p_answer1).toBe('hashed_a1');
      expect(args.p_answer2).toBe('hashed_a2');
      expect(args.p_answer3).toBe('hashed_a3');
    });

    it('returns false when answers do not match', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null });

      const result = await verifySecurityAnswers('a@b.com', '1', 'wrong', 'wrong', 'wrong');
      expect(result).toBe(false);
    });

    it('returns false on error (does not throw)', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      const result = await verifySecurityAnswers('a@b.com', '1', 'a', 'b', 'c');
      expect(result).toBe(false);
    });
  });

  // isPasswordReused
  describe('isPasswordReused', () => {
    it('returns true when password is reused', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });

      const result = await isPasswordReused(1, 'OldPass1!');
      expect(result).toBe(true);
    });

    it('returns false when password is new', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null });

      const result = await isPasswordReused(1, 'NewPass1!');
      expect(result).toBe(false);
    });

    it('hashes password before checking', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null });

      await isPasswordReused(1, 'TestPw');

      expect(mockRpc).toHaveBeenCalledWith('is_password_reused', {
        p_userid: 1,
        p_new_password_hash: 'hashed_TestPw',
      });
    });

    it('throws on error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC fail' } });

      await expect(isPasswordReused(1, 'pw')).rejects.toEqual({ message: 'RPC fail' });
    });
  });

  // updateUserPassword
  describe('updateUserPassword', () => {
    it('hashes and updates password', async () => {
      mockRpc.mockResolvedValue({ data: { success: true }, error: null });

      const result = await updateUserPassword(1, 'NewPass1!');

      expect(mockRpc).toHaveBeenCalledWith('update_user_password', {
        p_userid: 1,
        p_new_password_hash: 'hashed_NewPass1!',
      });
      expect(result).toEqual({ success: true });
    });

    it('throws on error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'expired' } });

      await expect(updateUserPassword(1, 'pw')).rejects.toEqual({ message: 'expired' });
    });
  });

  // adminUpdateUserSecurityAnswers
  describe('adminUpdateUserSecurityAnswers', () => {
    it('hashes and updates all three answers', async () => {
      mockRpc.mockResolvedValue({ data: { done: true }, error: null });

      await adminUpdateUserSecurityAnswers(5, 'new1', 'new2', 'new3');

      const args = mockRpc.mock.calls[0][1];
      expect(args.p_userid).toBe(5);
      expect(args.p_secanswer1).toBe('hashed_new1');
      expect(args.p_secanswer2).toBe('hashed_new2');
      expect(args.p_secanswer3).toBe('hashed_new3');
    });

    it('passes null for answers not provided', async () => {
      mockRpc.mockResolvedValue({ data: {}, error: null });

      await adminUpdateUserSecurityAnswers(5, null, 'only2', null);

      const args = mockRpc.mock.calls[0][1];
      expect(args.p_secanswer1).toBeNull();
      expect(args.p_secanswer2).toBe('hashed_only2');
      expect(args.p_secanswer3).toBeNull();
    });

    it('throws on error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'denied' } });

      await expect(adminUpdateUserSecurityAnswers(5, 'a', 'b', 'c')).rejects.toEqual({
        message: 'denied',
      });
    });
  });

  // getAllUserRequests
  describe('getAllUserRequests', () => {
    it('returns list of requests', async () => {
      const requests = [{ id: 1 }, { id: 2 }];
      mockRpc.mockResolvedValue({ data: requests, error: null });

      const result = await getAllUserRequests();
      expect(result).toEqual(requests);
    });

    it('returns empty array when data is null', async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const result = await getAllUserRequests();
      expect(result).toEqual([]);
    });

    it('throws on error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });

      await expect(getAllUserRequests()).rejects.toEqual({ message: 'timeout' });
    });
  });

  // approveUserRequest
  describe('approveUserRequest', () => {
    it('calls RPC with request ID, role, and actor', async () => {
      mockRpc.mockResolvedValue({ data: { approved: true }, error: null });

      const result = await approveUserRequest(10, 'accountant', 42);

      expect(mockRpc).toHaveBeenCalledWith('approve_user_request_with_actor', {
        p_userrequest_id: 10,
        p_role: 'accountant',
        p_changed_by: 42,
      });
      expect(result).toEqual({ approved: true });
    });

    it('throws on error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'already approved' } });

      await expect(approveUserRequest(10, 'manager', 1)).rejects.toEqual({
        message: 'already approved',
      });
    });
  });

  // rejectUserRequest
  describe('rejectUserRequest', () => {
    it('calls RPC with request ID and actor', async () => {
      mockRpc.mockResolvedValue({ data: { rejected: true }, error: null });

      const result = await rejectUserRequest(10, 42);

      expect(mockRpc).toHaveBeenCalledWith('reject_user_request_with_actor', {
        p_userrequest_id: 10,
        p_changed_by: 42,
      });
      expect(result).toEqual({ rejected: true });
    });

    it('throws on error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'not found' } });

      await expect(rejectUserRequest(999, 1)).rejects.toEqual({ message: 'not found' });
    });
  });


  // getPasswords 
  describe('getPasswords', () => {
    it('calls the correct RPC', async () => {
      mockRpc.mockResolvedValue({ data: [{ id: 1 }], error: null });

      await getPasswords();
      expect(mockRpc).toHaveBeenCalledWith('get_userpasswords');
    });

    it('does not throw on error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'fail' } });

      await expect(getPasswords()).resolves.not.toThrow();
    });
  });
});
