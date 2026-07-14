export function registerAuthRoutes(app, dependencies) {
  const {
    AppError,
    LIMITS,
    authenticateUser,
    createAndSendVerificationCode,
    deleteCookie,
    getAuthenticatedRequestUser,
    getCookie,
    getEmailVerificationState,
    generateTokens,
    hashPassword,
    hashCode,
    logSignupFailure,
    logVerificationEmailFailure,
    readJson,
    requireEmailCodePepper,
    requireDb,
    requireJwtSecret,
    requireVerifiedAuth,
    setCookie,
    sign,
    syncLegacyEmailVerificationMirror,
    validateEmail,
    validatePassword,
    validateUsername,
    validateVerificationEmail,
    validateVerificationPurpose,
    verificationSentResponse,
    verify,
    verifyPassword,
  } = dependencies;

  app.post('/api/auth/signup', async (c) => {
    let signupStep = 'initialize';
    try {
      signupStep = 'load_database';
      const db = requireDb(c.env);

      signupStep = 'read_request_body';
      const { username, email, password } = await readJson(c, LIMITS.authBody);

      signupStep = 'validate_request_fields';
      const trimmedUsername = validateUsername(username);
      const normalizedEmail = validateEmail(email);
      validatePassword(password);

      // Check uniqueness
      signupStep = 'check_existing_user';
      const existingUser = await db
        .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
        .bind(trimmedUsername, normalizedEmail)
        .first();

      if (existingUser) {
        return c.json(
          {
            error: 'Username or email already in use.',
            message: 'Username or email already in use.',
            code: 'ACCOUNT_EXISTS',
          },
          409
        );
      }

      signupStep = 'hash_password';
      const hashedPassword = await hashPassword(password);

      signupStep = 'generate_user_id';
      const userId = crypto.randomUUID();

      signupStep = 'insert_user';
      await db
        .prepare(
          'INSERT INTO users (id, username, email, password, isEmailVerified, email_verified_at) VALUES (?, ?, ?, ?, 0, NULL)'
        )
        .bind(userId, trimmedUsername, normalizedEmail, hashedPassword)
        .run();

      signupStep = 'send_verification_code';
      let codeSent = false;
      let errorCode = null;
      let errorMessage = 'Check your email for a verification code.';
      try {
        await createAndSendVerificationCode(c.env, db, normalizedEmail, 'signup');
        codeSent = true;
      } catch (err) {
        if (err instanceof AppError) {
          if (
            err.code === 'missing_email_code_pepper' ||
            err.code === 'missing_email_delivery_config'
          ) {
            errorCode = 'EMAIL_NOT_CONFIGURED';
          } else {
            errorCode = err.code;
          }
          errorMessage = err.message;
        } else {
          errorCode = 'email_send_failed';
          errorMessage = 'Unable to send verification email.';
        }
      }

      if (!codeSent) {
        return c.json(
          {
            ok: true,
            emailVerified: false,
            isEmailVerified: false,
            verificationRequired: true,
            codeSent: false,
            code: errorCode,
            message:
              errorCode === 'EMAIL_NOT_CONFIGURED'
                ? 'Account created. Email verification is not configured.'
                : `Account created. ${errorMessage}`,
            username: trimmedUsername,
            email: normalizedEmail,
          },
          201
        );
      }

      return c.json(
        {
          ok: true,
          emailVerified: false,
          isEmailVerified: false,
          verificationRequired: true,
          codeSent,
          message: 'Check your email for a verification code.',
          username: trimmedUsername,
          email: normalizedEmail,
        },
        201
      );
    } catch (err) {
      logSignupFailure(c, signupStep, err);
      if (err instanceof AppError) throw err;
      throw new AppError(500, 'Internal Server Error', 'signup_failed');
    }
  });

  app.post('/api/auth/login', async (c) => {
    try {
      const db = requireDb(c.env);
      const { username, password } = await readJson(c, LIMITS.authBody);
      const trimmedUsername = validateUsername(username);
      if (typeof password !== 'string' || password.length === 0 || password.length > 1024) {
        return c.json({ message: 'Invalid username or password' }, 401);
      }

      const user = await db
        .prepare(
          'SELECT id, username, email, password, isEmailVerified, email_verified_at FROM users WHERE username = ?'
        )
        .bind(trimmedUsername)
        .first();

      if (!user) {
        // Mitigate timing attacks by always performing verification work
        await verifyPassword(password, '');
        return c.json({ message: 'Invalid username or password' }, 401);
      }

      const isMatch = await verifyPassword(password, user.password);
      if (!isMatch) {
        return c.json({ message: 'Invalid username or password' }, 401);
      }

      if (!user.email_verified_at) {
        await syncLegacyEmailVerificationMirror(db, user);
        await createAndSendVerificationCode(c.env, db, user.email, 'signup');
        return c.json(
          {
            message: 'Email verification required',
            code: 'email_verification_required',
            ...getEmailVerificationState(user),
            verificationRequired: true,
            email: user.email,
          },
          403
        );
      }

      await syncLegacyEmailVerificationMirror(db, user);

      const { accessToken, refreshToken } = await generateTokens(
        user,
        c.env,
        c.req.header('user-agent'),
        c.req.header('cf-connecting-ip')
      );

      setCookie(c, 'refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });

      return c.json({
        token: accessToken,
        username: user.username,
        email: user.email,
        ...getEmailVerificationState(user),
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(500, 'Internal Server Error', 'login_failed');
    }
  });

  app.post('/api/auth/check-username', async (c) => {
    const db = requireDb(c.env);
    const { username } = await readJson(c, LIMITS.authBody);
    const trimmedUsername = validateUsername(username);

    const user = await db
      .prepare('SELECT id FROM users WHERE username = ?')
      .bind(trimmedUsername)
      .first();
    if (user) {
      const suggestions = [
        `${trimmedUsername}${Math.floor(Math.random() * 99)}`,
        `${trimmedUsername}_edit`,
        `sync_${trimmedUsername}`,
      ];
      return c.json({ available: false, suggestions });
    }
    return c.json({ available: true });
  });

  app.post('/api/auth/logout', async (c) => {
    const db = requireDb(c.env);
    const cookieToken = getCookie(c, 'refreshToken');
    if (cookieToken) {
      try {
        const decoded = await verify(cookieToken, requireJwtSecret(c.env), 'HS256');
        await db.prepare('DELETE FROM sessions WHERE id = ?').bind(decoded.sessionId).run();
      } catch {}
    }
    deleteCookie(c, 'refreshToken', { path: '/' });
    return c.json({ message: 'Logged out successfully' });
  });

  app.post('/api/auth/refresh-token', async (c) => {
    const db = requireDb(c.env);
    const cookieToken = getCookie(c, 'refreshToken');
    if (!cookieToken) {
      return c.json({ message: 'Refresh token required' }, 401);
    }

    const jwtSecret = requireJwtSecret(c.env);
    try {
      const decoded = await verify(cookieToken, jwtSecret, 'HS256');
      const session = await db
        .prepare('SELECT id FROM sessions WHERE id = ?')
        .bind(decoded.sessionId)
        .first();
      if (!session) {
        return c.json({ message: 'Session expired' }, 401);
      }

      const user = await db
        .prepare(
          'SELECT id, username, email, isEmailVerified, email_verified_at FROM users WHERE id = ?'
        )
        .bind(decoded.id)
        .first();
      if (!user) {
        return c.json({ message: 'User not found' }, 401);
      }

      // Generate new access token
      const accessToken = await sign(
        {
          id: decoded.id,
          username: user.username,
          sessionId: decoded.sessionId,
          exp: Math.floor(Date.now() / 1000) + 15 * 60,
        },
        jwtSecret
      );

      await db
        .prepare("UPDATE sessions SET lastActive = datetime('now') WHERE id = ?")
        .bind(decoded.sessionId)
        .run();

      await syncLegacyEmailVerificationMirror(db, user);

      return c.json({
        token: accessToken,
        ...getEmailVerificationState(user),
      });
    } catch {
      return c.json({ message: 'Invalid refresh token' }, 401);
    }
  });

  app.post('/api/auth/send-verification', async (c) => {
    let normalizedEmail = null;
    let verificationPurpose = null;
    try {
      const db = requireDb(c.env);
      const { email, purpose } = await readJson(c, LIMITS.authBody);
      const authenticatedUser = await getAuthenticatedRequestUser(c, db);
      normalizedEmail = authenticatedUser
        ? authenticatedUser.email
        : validateVerificationEmail(email);
      verificationPurpose = validateVerificationPurpose(purpose);

      await createAndSendVerificationCode(c.env, db, normalizedEmail, verificationPurpose);
      return verificationSentResponse(c);
    } catch (err) {
      if (err instanceof AppError) {
        if (
          err.code === 'missing_email_code_pepper' ||
          err.code === 'missing_email_delivery_config'
        ) {
          return c.json(
            {
              error: 'Email verification is not configured for this environment.',
              message: 'Email verification is not configured for this environment.',
              code: 'EMAIL_NOT_CONFIGURED',
            },
            500
          );
        }
        if (err.code === 'email_send_failed') {
          logVerificationEmailFailure(
            c,
            '/api/auth/send-verification',
            normalizedEmail,
            verificationPurpose,
            err
          );
        }
        throw err;
      }
      throw new AppError(500, 'Internal Server Error', 'send_verification_failed');
    }
  });

  app.post('/api/auth/resend-code', async (c) => {
    let normalizedEmail = null;
    let verificationPurpose = null;
    try {
      const db = requireDb(c.env);
      const { email, purpose } = await readJson(c, LIMITS.authBody);
      normalizedEmail = validateVerificationEmail(email);
      verificationPurpose = validateVerificationPurpose(purpose);

      await createAndSendVerificationCode(c.env, db, normalizedEmail, verificationPurpose);
      return verificationSentResponse(c);
    } catch (err) {
      if (err instanceof AppError) {
        if (
          err.code === 'missing_email_code_pepper' ||
          err.code === 'missing_email_delivery_config'
        ) {
          return c.json(
            {
              error: 'Email verification is not configured for this environment.',
              message: 'Email verification is not configured for this environment.',
              code: 'EMAIL_NOT_CONFIGURED',
            },
            500
          );
        }
        if (err.code === 'email_send_failed') {
          logVerificationEmailFailure(
            c,
            '/api/auth/resend-code',
            normalizedEmail,
            verificationPurpose,
            err
          );
        }
        throw err;
      }
      throw new AppError(500, 'Internal Server Error', 'resend_code_failed');
    }
  });

  app.post('/api/auth/verify-email', async (c) => {
    try {
      const db = requireDb(c.env);
      const { email, code, purpose } = await readJson(c, LIMITS.authBody);
      const authenticatedUser = await getAuthenticatedRequestUser(c, db);
      const normalizedEmail = authenticatedUser
        ? authenticatedUser.email
        : validateVerificationEmail(email);
      const submittedCode = String(code || '').trim();
      const verificationPurpose = validateVerificationPurpose(purpose);

      if (!/^\d{6}$/.test(submittedCode)) {
        throw new AppError(400, 'Verification code must be 6 digits', 'invalid_code');
      }

      const row = await db
        .prepare(
          `
          SELECT id, email, code_hash, attempts, expires_at, consumed_at
          FROM email_verification_codes
          WHERE email = ?
            AND purpose = ?
            AND consumed_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1
        `
        )
        .bind(normalizedEmail, verificationPurpose)
        .first();

      if (!row) {
        throw new AppError(400, 'Invalid or expired verification code', 'invalid_code');
      }

      const now = Math.floor(Date.now() / 1000);
      if (Number(row.expires_at) < now) {
        throw new AppError(400, 'Invalid or expired verification code', 'code_expired');
      }

      if (Number(row.attempts) >= 5) {
        throw new AppError(400, 'Too many failed verification attempts', 'too_many_attempts');
      }

      const pepper = requireEmailCodePepper(c.env);
      const submittedHash = await hashCode({
        email: normalizedEmail,
        code: submittedCode,
        pepper,
      });

      if (submittedHash !== row.code_hash) {
        await db
          .prepare('UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = ?')
          .bind(row.id)
          .run();
        throw new AppError(400, 'Invalid or expired verification code', 'invalid_code');
      }

      await db
        .prepare('UPDATE email_verification_codes SET consumed_at = ? WHERE id = ?')
        .bind(now, row.id)
        .run();

      if (authenticatedUser) {
        await db
          .prepare(
            'UPDATE users SET email_verified_at = ?, isEmailVerified = 1 WHERE id = ? AND email = ?'
          )
          .bind(now, authenticatedUser.id, normalizedEmail)
          .run();
      } else {
        await db
          .prepare('UPDATE users SET email_verified_at = ?, isEmailVerified = 1 WHERE email = ?')
          .bind(now, normalizedEmail)
          .run();
      }

      return c.json({
        ok: true,
        ...getEmailVerificationState({ email_verified_at: now }),
        message: 'Email verified.',
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(500, 'Internal Server Error', 'verification_failed');
    }
  });

  app.get('/api/auth/ws-ticket', authenticateUser, requireVerifiedAuth, async (c) => {
    const user = c.get('user');
    const jwtSecret = requireJwtSecret(c.env);

    // Create short-lived ticket JWT (valid for 30s)
    const ticket = await sign(
      {
        sub: user.id,
        username: user.username,
        sessionId: user.sessionId,
        type: 'ws-ticket',
        exp: Math.floor(Date.now() / 1000) + 30,
      },
      jwtSecret
    );

    return c.json({ ticket });
  });
}
