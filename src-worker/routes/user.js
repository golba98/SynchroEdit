export function registerUserRoutes(app, dependencies) {
  const {
    LIMITS,
    authenticateUser,
    getEmailVerificationState,
    hashPassword,
    readJson,
    requireDb,
    requireVerifiedAuth,
    syncLegacyEmailVerificationMirror,
    validatePassword,
    validateUuid,
    verifyPassword,
  } = dependencies;

  app.get('/api/user/profile', authenticateUser, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const profile = await db
      .prepare(
        'SELECT id, username, email, profilePicture, accentColor, bio, showOnlineStatus, isEmailVerified, email_verified_at, createdAt FROM users WHERE id = ?'
      )
      .bind(user.id)
      .first();

    if (!profile) return c.json({ message: 'User not found' }, 404);
    await syncLegacyEmailVerificationMirror(db, profile);
    return c.json({
      ...profile,
      showOnlineStatus: profile.showOnlineStatus === 1,
      ...getEmailVerificationState(profile),
    });
  });

  app.put('/api/user/profile', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const { profilePicture, accentColor, bio, showOnlineStatus } = await readJson(
      c,
      LIMITS.profileBody
    );

    const current = await db.prepare('SELECT id FROM users WHERE id = ?').bind(user.id).first();
    if (!current) return c.json({ message: 'User not found' }, 404);

    const updates = [];
    const bindings = [];

    if (profilePicture !== undefined) {
      if (typeof profilePicture !== 'string' || profilePicture.length > LIMITS.profilePicture) {
        throw new AppError(400, 'Invalid profile picture', 'invalid_profile_picture');
      }
      updates.push('profilePicture = ?');
      bindings.push(profilePicture);
    }
    if (accentColor !== undefined) {
      if (typeof accentColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
        throw new AppError(400, 'Invalid accent color', 'invalid_accent_color');
      }
      updates.push('accentColor = ?');
      bindings.push(accentColor);
    }
    if (bio !== undefined) {
      if (typeof bio !== 'string' || bio.length > LIMITS.bio) {
        throw new AppError(400, 'Invalid bio', 'invalid_bio');
      }
      updates.push('bio = ?');
      bindings.push(bio);
    }
    if (showOnlineStatus !== undefined) {
      if (typeof showOnlineStatus !== 'boolean') {
        throw new AppError(400, 'showOnlineStatus must be a boolean', 'invalid_show_online_status');
      }
      updates.push('showOnlineStatus = ?');
      bindings.push(showOnlineStatus ? 1 : 0);
    }

    if (updates.length > 0) {
      bindings.push(user.id);
      await db
        .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...bindings)
        .run();
    }

    return c.json({
      message: 'Profile updated successfully',
      profilePicture,
      accentColor,
      bio,
      showOnlineStatus,
    });
  });

  app.put('/api/user/password', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const { currentPassword, newPassword } = await readJson(c, LIMITS.authBody);

    const userRecord = await db
      .prepare('SELECT password FROM users WHERE id = ?')
      .bind(user.id)
      .first();
    if (!userRecord) return c.json({ message: 'User not found' }, 404);

    const isMatch = await verifyPassword(currentPassword, userRecord.password);
    if (!isMatch) return c.json({ message: 'Current password incorrect' }, 400);

    validatePassword(newPassword);

    const hashedPassword = await hashPassword(newPassword);
    await db
      .prepare('UPDATE users SET password = ? WHERE id = ?')
      .bind(hashedPassword, user.id)
      .run();

    return c.json({ message: 'Password updated successfully' });
  });

  app.get('/api/user/sessions', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const sessions = await db
      .prepare(
        'SELECT id as sessionId, userAgent, ipAddress, lastActive FROM sessions WHERE userId = ?'
      )
      .bind(user.id)
      .all();

    const mapped = (sessions.results || []).map((s) => ({
      ...s,
      isCurrent: s.sessionId === user.sessionId,
    }));

    return c.json(mapped);
  });

  app.delete('/api/user/sessions/:sessionId', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const sessionId = validateUuid(c.req.param('sessionId'), 'session id');
    await db
      .prepare('DELETE FROM sessions WHERE id = ? AND userId = ?')
      .bind(sessionId, user.id)
      .run();
    return c.json({ message: 'Session revoked' });
  });

  app.delete('/api/user/sessions', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    await db
      .prepare('DELETE FROM sessions WHERE userId = ? AND id != ?')
      .bind(user.id, user.sessionId)
      .run();
    return c.json({ message: 'All other sessions revoked' });
  });
}
