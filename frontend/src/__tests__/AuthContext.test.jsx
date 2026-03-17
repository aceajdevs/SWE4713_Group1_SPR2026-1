import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '../AuthContext';

// ── Mock supabase ──────────────────────────────
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } });
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({ error: null });
const mockOnAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: vi.fn() } },
}));

vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: (...args) => mockGetUser(...args),
      signInWithPassword: (...args) => mockSignInWithPassword(...args),
      signUp: (...args) => mockSignUp(...args),
      signOut: (...args) => mockSignOut(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// Helper component to expose context values in the DOM for testing
function AuthConsumer() {
  const { user, loading, error, login, loginWithUserData, signup, logout } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? JSON.stringify(user) : 'null'}</span>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error || 'none'}</span>
      <button data-testid="login" onClick={() => login('test@test.com', 'pass').catch(() => {})} />      <button
        data-testid="loginWithUserData"
        onClick={() =>
          loginWithUserData({
            userID: 1,
            username: 'admin',
            email: 'admin@test.com',
            role: 'administrator',
            fName: 'Admin',
            lName: 'User',
            status: true,
          })
        }
      />
      <button data-testid="signup" onClick={() => signup('new@test.com', 'pass')} />
      <button data-testid="logout" onClick={() => logout()} />
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  // ══════════════════════════════════════════════
  // PROVIDER BASICS
  // ══════════════════════════════════════════════
  describe('provider basics', () => {
    it('renders children', () => {
      render(
        <AuthProvider>
          <span data-testid="child">hello</span>
        </AuthProvider>
      );
      expect(screen.getByTestId('child')).toHaveTextContent('hello');
    });

    it('throws when useAuth is used outside provider', () => {
      // Suppress console.error for the expected error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<AuthConsumer />)).toThrow(
        'useAuth must be used within an AuthProvider'
      );
      consoleSpy.mockRestore();
    });

    it('starts with null user', async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      );
      // After effects settle, user should be null
      await act(async () => {});
      expect(screen.getByTestId('user')).toHaveTextContent('null');
    });
  });

  // ══════════════════════════════════════════════
  // SESSION STORAGE RESTORE
  // ══════════════════════════════════════════════
  describe('session storage restoration', () => {
    it('restores user from sessionStorage on mount', async () => {
      const storedUser = { userID: 1, username: 'saved', role: 'manager' };
      sessionStorage.setItem('currentUser', JSON.stringify(storedUser));

      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      );

      await act(async () => {});
      expect(screen.getByTestId('user')).toHaveTextContent('"username":"saved"');
    });

    it('handles corrupted sessionStorage gracefully', async () => {
      sessionStorage.setItem('currentUser', 'not-valid-json{{{');

      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      );

      await act(async () => {});
      // Should fall back to null user without crashing
      expect(screen.getByTestId('user')).toHaveTextContent('null');
      // Corrupted data should be cleared
      expect(sessionStorage.getItem('currentUser')).toBeNull();
    });
  });

  // ══════════════════════════════════════════════
  // loginWithUserData
  // ══════════════════════════════════════════════
  describe('loginWithUserData', () => {
    it('sets user and stores in sessionStorage', async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      );

      await act(async () => {
        screen.getByTestId('loginWithUserData').click();
      });

      expect(screen.getByTestId('user')).toHaveTextContent('"username":"admin"');
      expect(sessionStorage.getItem('currentUser')).toBeTruthy();
      const stored = JSON.parse(sessionStorage.getItem('currentUser'));
      expect(stored.role).toBe('administrator');
    });
  });

  // ══════════════════════════════════════════════
  // login (supabase auth)
  // ══════════════════════════════════════════════
  describe('login', () => {
    it('calls supabase signInWithPassword', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'uuid' } },
        error: null,
      });

      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      );

      await act(async () => {
        screen.getByTestId('login').click();
      });

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@test.com',
        password: 'pass',
      });
    });

    it('sets error state on login failure', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials' },
      });

      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      );

      await act(async () => {
         screen.getByTestId('login').click();
            await new Promise((r) => setTimeout(r, 0));
        });

      expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
    });
  });

  // ══════════════════════════════════════════════
  // signup
  // ══════════════════════════════════════════════
  describe('signup', () => {
    it('calls supabase signUp', async () => {
      mockSignUp.mockResolvedValue({ data: { user: { id: 'new-uuid' } }, error: null });

      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      );

      await act(async () => {
        screen.getByTestId('signup').click();
      });

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@test.com',
        password: 'pass',
      });
    });
  });

  // ══════════════════════════════════════════════
  // logout
  // ══════════════════════════════════════════════
  describe('logout', () => {
    it('clears user and sessionStorage', async () => {
      sessionStorage.setItem(
        'currentUser',
        JSON.stringify({ userID: 1, username: 'test' })
      );

      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      );

      await act(async () => {
        screen.getByTestId('logout').click();
      });

      expect(screen.getByTestId('user')).toHaveTextContent('null');
      expect(sessionStorage.getItem('currentUser')).toBeNull();
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
