import { supabase } from '../supabaseClient';
import { sendAdminEmail } from './emailService';
import { checkPasswordsAboutToExpire } from './passwordExpiryService';

export async function sendPasswordExpiryNotifications(daysBeforeExpiry = 3) {
  const expiring = await checkPasswordsAboutToExpire(daysBeforeExpiry);

  const pending = expiring.filter((e) => e.userID != null);
  if (pending.length === 0) {
    return { sent: 0, failed: 0, errors: [] };
  }

  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const row of pending) {
    if (!row?.email?.trim()) {
      failed += 1;
      errors.push({ userID: row.userID, error: 'No email address on file' });
      continue;
    }

    const { data: latest, error: latestError } = await supabase
      .from('user')
      .select('passwordExpiryWarningSentAt')
      .eq('userID', row.userID)
      .maybeSingle();

    if (latestError) {
      failed += 1;
      errors.push({ userID: row.userID, error: latestError.message });
      continue;
    }

    if (latest?.passwordExpiryWarningSentAt) {
      continue;
    }

    const recipientName = [row.fName, row.lName].filter(Boolean).join(' ') || row.username || 'User';
    const expiryLabel = new Date(row.passwordExpires).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const subject = 'Your password will expire soon';
    const message = [
      `Hello ${recipientName},`,
      '',
      `Your password is scheduled to expire on ${expiryLabel}.`,
      '',
      'Account details:',
      `  User ID: ${row.userID}`,
      `  Username: ${row.username ?? 'N/A'}`,
      `  Email: ${row.email}`,
      '',
      'Please sign in and change your password before it expires.',
    ].join('\n');

    try {
      await sendAdminEmail(row.email.trim(), recipientName, subject, message);

      const sentAtIso = new Date().toISOString();
      const { data: updatedUser, error: updateError } = await supabase
        .from('user')
        .update({ passwordExpiryWarningSentAt: sentAtIso })
        .eq('userID', row.userID)
        .is('passwordExpiryWarningSentAt', null)
        .select('passwordExpiryWarningSentAt')
        .maybeSingle();

      if (updateError) {
        failed += 1;
        errors.push({ userID: row.userID, error: updateError.message });
        continue;
      }

      if (!updatedUser) {
        failed += 1;
        errors.push({ userID: row.userID, error: 'User was already marked as notified.' });
        continue;
      }

      const markedAt = updatedUser.passwordExpiryWarningSentAt;
      console.log('[PasswordExpiry] Marked notified after email', {
        userID: row.userID,
        passwordExpiryWarningSentAt: markedAt,
      });

      sent += 1;
    } catch (err) {
      failed += 1;
      errors.push({ userID: row.userID, error: err?.message ?? String(err) });
    }
  }

  return { sent, failed, errors };
}
