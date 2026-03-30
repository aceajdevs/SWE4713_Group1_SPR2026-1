import { supabase } from '../supabaseClient';

export async function checkPasswordsAboutToExpire(days = 3) {
  try {
    const { data, error } = await supabase
      .from('user')
      .select('userID, passwordExpires, passwordExpiryWarningSentAt, email, fName, lName, username, status');

    if (error) {
      console.error('Error fetching users for password expiry:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const now = new Date();
    const windowMs = days * 24 * 60 * 60 * 1000;
    const expiring = [];

    data.forEach((row) => {
      if (!row.passwordExpires) return;
      if (row.passwordExpiryWarningSentAt) return;
      if (row.status === false) return;

      const expiresAt = new Date(row.passwordExpires);
      const diffMs = expiresAt.getTime() - now.getTime();

      if (diffMs > 0 && diffMs <= windowMs) {
        expiring.push({
          userID: row.userID,
          passwordExpires: expiresAt.toISOString(),
          passwordExpiryWarningSentAt: row.passwordExpiryWarningSentAt ?? null,
          email: row.email ?? null,
          fName: row.fName ?? null,
          lName: row.lName ?? null,
          username: row.username ?? null,
        });
      }
    });

    return expiring;
  } catch (err) {
    console.error('Unexpected error checking password expirations:', err);
    return [];
  }
}