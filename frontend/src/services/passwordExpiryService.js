// passwordExpiryService.js
import { supabase } from '../supabaseClient';

export async function checkPasswordsAboutToExpire(days = 3) {
  try {
    const { data, error } = await supabase
      .from('userPasswords')
      .select('passwordID, activeTill, userID');

    if (error) {
      console.error('Error fetching userPasswords:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const now = new Date();
    const windowMs = days * 24 * 60 * 60 * 1000;
    const expiring = [];

    data.forEach((row) => {
      if (!row.activeTill) return;

      const expiresAt = new Date(row.activeTill);
      const diffMs = expiresAt.getTime() - now.getTime();

      if (diffMs > 0 && diffMs <= windowMs) {
        expiring.push({
          passwordID: row.passwordID,
          userID: row.userID,
          activeTill: expiresAt.toISOString(),
        });
      }
    });

    return expiring;
  } catch (err) {
    console.error('Unexpected error checking password expirations:', err);
    return [];
  }
}