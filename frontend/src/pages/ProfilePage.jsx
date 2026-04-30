import React, { useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';
import { updateUserPicturePath } from '../services/userService';
import { HelpTooltip } from '../components/HelpTooltip';

export default function ProfilePage() {
  const { user, updateCurrentUser } = useAuth();
  const [picturePath, setPicturePath] = useState(user?.picture_path ?? user?.picturePath ?? '');
  const [saving, setSaving] = useState(false);

  const fullName = useMemo(() => {
    const f = user?.fName ? String(user.fName).trim() : '';
    const l = user?.lName ? String(user.lName).trim() : '';
    const combined = `${f} ${l}`.trim();
    return combined || '(No name on file)';
  }, [user?.fName, user?.lName]);

  const handleSave = async () => {
    if (!user?.userID) {
      alert('You must be logged in to update your profile.');
      return;
    }

    const trimmed = String(picturePath ?? '').trim();

    setSaving(true);
    try {
      const updated = await updateUserPicturePath({
        userId: user.userID,
        picturePath: trimmed.length > 0 ? trimmed : null,
      });

      // Keep navbar + sessionStorage in sync immediately.
      const nextPicturePath = updated?.picture_path ?? trimmed ?? null;
      updateCurrentUser({ picture_path: nextPicturePath });

      alert('Profile updated.');
    } catch (e) {
      console.error('Failed to update picture_path:', e);
      alert('Failed to save picture URL. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div style={{ width: '100%', flex: 1, display: 'flex', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: '100%', maxWidth: 720, background: 'white', borderRadius: 12, padding: 20 }}>
          <h1>Profile</h1>
          <p>You are not currently signed in.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', flex: 1, display: 'flex', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 720, background: 'white', borderRadius: 12, padding: 20 }}>
        <h1>Profile</h1>

        <div role="group" aria-label="Profile details" style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'baseline' }}>
            <div style={{ color: 'var(--bff-primary)', fontWeight: 600 }}>User ID</div>
            <div>{user.userID ?? '(Unknown)'}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'baseline' }}>
            <div style={{ color: 'var(--bff-primary)', fontWeight: 600 }}>Name</div>
            <div>{fullName}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'baseline' }}>
            <div style={{ color: 'var(--bff-primary)', fontWeight: 600 }}>Username</div>
            <div>{user.username ?? '(Unknown)'}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'baseline' }}>
            <div style={{ color: 'var(--bff-primary)', fontWeight: 600 }}>Role</div>
            <div>{user.role ?? '(Unknown)'}</div>
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--bff-secondary)', margin: '18px 0' }} />

        <div style={{ display: 'grid', gap: 10 }}>
          <label htmlFor="picturePath" style={{ color: 'var(--bff-primary)', fontWeight: 600 }}>
            Picture URL
          </label>
          <HelpTooltip text="Paste an image URL to show as your avatar in the navbar. Leave blank to remove it.">
            <input
              id="picturePath"
              className="input"
              type="url"
              placeholder="https://example.com/avatar.png"
              value={picturePath}
              onChange={(e) => setPicturePath(e.target.value)}
              disabled={saving}
            />
          </HelpTooltip>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="button-secondary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

