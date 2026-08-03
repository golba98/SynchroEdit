export function registerDocumentsRoutes(app, dependencies) {
  const {
    AppError,
    LIMITS,
    assertDocumentEditable,
    assertDocumentOwner,
    assertDocumentReadable,
    authenticateUser,
    getDocumentAccess,
    logHistory,
    readJson,
    requireDb,
    requireVerifiedAuth,
    validateBoolean,
    validatePageContent,
    validateTitle,
    validateUsername,
    validateUuid,
  } = dependencies;

  app.get('/api/documents', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10) || 20));
    const offset = (page - 1) * limit;

    // Count total matching documents
    const countRes = await db
      .prepare(
        `
    SELECT COUNT(d.id) as count
    FROM documents d
    WHERE d.owner = ?
       OR d.id IN (SELECT documentId FROM document_permissions WHERE userId = ?)
       OR (d.isPublic = 1 AND d.id IN (SELECT documentId FROM recent_documents WHERE userId = ?))
  `
      )
      .bind(user.id, user.id, user.id)
      .first();

    const totalDocuments = countRes ? countRes.count : 0;

    // Retrieve documents with owner names
    const docsRes = await db
      .prepare(
        `
    SELECT d.id, d.title, d.owner, d.lastModified, d.lastModifiedBy, u.username as ownerUsername, l.username as lastModifiedByUsername
    FROM documents d
    LEFT JOIN users u ON d.owner = u.id
    LEFT JOIN users l ON d.lastModifiedBy = l.id
    WHERE d.owner = ?
       OR d.id IN (SELECT documentId FROM document_permissions WHERE userId = ?)
       OR (d.isPublic = 1 AND d.id IN (SELECT documentId FROM recent_documents WHERE userId = ?))
    ORDER BY d.lastModified DESC
    LIMIT ? OFFSET ?
  `
      )
      .bind(user.id, user.id, user.id, limit, offset)
      .all();

    const documentsWithStatus = (docsRes.results || []).map((doc) => ({
      ...doc,
      _id: doc.id,
      isOwner: doc.owner === user.id,
      isShared: doc.owner !== user.id,
      pages: [], // loaded separately on detail load or real-time sync
    }));

    return c.json({
      documents: documentsWithStatus,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalDocuments / limit),
        totalDocuments,
        hasNextPage: page * limit < totalDocuments,
        hasPrevPage: page > 1,
      },
    });
  });

  app.post('/api/documents', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const body = await readJson(c, LIMITS.documentBody);
    const title = validateTitle(body.title);
    const pages =
      Array.isArray(body.pages) && body.pages.length > 0 ? body.pages : [{ content: '' }];
    const firstPageContent = validatePageContent(pages[0] && pages[0].content);
    const docId = crypto.randomUUID();

    // Create document
    await db
      .prepare('INSERT INTO documents (id, title, owner, lastModifiedBy) VALUES (?, ?, ?, ?)')
      .bind(docId, title, user.id, user.id)
      .run();

    // Create initial page
    if (pages.length > 0) {
      await db
        .prepare('INSERT INTO document_pages (documentId, pageIndex, content) VALUES (?, 0, ?)')
        .bind(docId, firstPageContent)
        .run();
    }

    // Create recent entry
    await db
      .prepare('INSERT INTO recent_documents (userId, documentId) VALUES (?, ?)')
      .bind(user.id, docId)
      .run();

    await logHistory(db, docId, user.id, user.username, 'Created Document');

    return c.json(
      {
        id: docId,
        _id: docId,
        title,
        owner: user.id,
        pages: [{ content: firstPageContent }],
      },
      201
    );
  });

  app.patch('/api/documents/:id', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const docId = validateUuid(c.req.param('id'), 'document id');
    const body = await readJson(c, LIMITS.documentBody);
    const access = await getDocumentAccess(db, docId, user.id);
    assertDocumentEditable(access);

    const updates = ["lastModified = datetime('now')", 'lastModifiedBy = ?'];
    const bindings = [user.id];
    let title;
    let firstPageContent;

    if (body.title !== undefined) {
      title = validateTitle(body.title);
      updates.push('title = ?');
      bindings.push(title);
    }

    if (body.pages !== undefined) {
      if (!Array.isArray(body.pages)) {
        throw new AppError(400, 'Pages must be an array', 'invalid_pages');
      }
      firstPageContent = validatePageContent(body.pages[0] && body.pages[0].content);
    }

    if (updates.length > 2) {
      bindings.push(docId);
      await db
        .prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...bindings)
        .run();
    } else {
      await db
        .prepare(
          "UPDATE documents SET lastModified = datetime('now'), lastModifiedBy = ? WHERE id = ?"
        )
        .bind(user.id, docId)
        .run();
    }

    if (firstPageContent !== undefined) {
      await db.prepare('DELETE FROM document_pages WHERE documentId = ?').bind(docId).run();
      await db
        .prepare('INSERT INTO document_pages (documentId, pageIndex, content) VALUES (?, 0, ?)')
        .bind(docId, firstPageContent)
        .run();
    }

    await logHistory(db, docId, user.id, user.username, 'Updated Document');

    return c.json({
      id: docId,
      _id: docId,
      title: title || access.doc.title,
      pages: firstPageContent === undefined ? undefined : [{ content: firstPageContent }],
    });
  });

  app.post('/api/documents/:id/recent', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const docId = validateUuid(c.req.param('id'), 'document id');

    // Verify access permissions
    const access = await getDocumentAccess(db, docId, user.id);
    assertDocumentReadable(access);

    // Upsert in recent_documents
    await db
      .prepare(
        "INSERT OR REPLACE INTO recent_documents (userId, documentId, accessedAt) VALUES (?, ?, datetime('now'))"
      )
      .bind(user.id, docId)
      .run();

    // Keep only last 20 recent docs
    const recents = await db
      .prepare('SELECT documentId FROM recent_documents WHERE userId = ? ORDER BY accessedAt DESC')
      .bind(user.id)
      .all();

    if (recents.results && recents.results.length > 20) {
      const thresholdDate = recents.results[19].accessedAt;
      await db
        .prepare('DELETE FROM recent_documents WHERE userId = ? AND accessedAt < ?')
        .bind(user.id, thresholdDate)
        .run();
    }

    return c.json({ message: 'Added to recent' });
  });

  app.get('/api/documents/:id/settings', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const docId = validateUuid(c.req.param('id'), 'document id');

    const access = await getDocumentAccess(db, docId, user.id);
    assertDocumentReadable(access);

    return c.json({
      isPublic: access.isPublic,
      isOwner: access.isOwner,
      isShared: access.role === 'editor',
      canEdit: access.canEdit,
    });
  });

  app.patch('/api/documents/:id/settings', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const docId = validateUuid(c.req.param('id'), 'document id');
    const { isPublic } = await readJson(c, LIMITS.authBody);

    const access = await getDocumentAccess(db, docId, user.id);
    assertDocumentOwner(access);

    const isPublicVal = validateBoolean(isPublic, 'isPublic') ? 1 : 0;
    await db
      .prepare('UPDATE documents SET isPublic = ? WHERE id = ?')
      .bind(isPublicVal, docId)
      .run();

    return c.json({
      message: 'Settings updated',
      isPublic: isPublicVal === 1,
    });
  });

  app.delete('/api/documents/:id', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const docId = validateUuid(c.req.param('id'), 'document id');

    let access;
    try {
      access = await getDocumentAccess(db, docId, user.id);
    } catch (err) {
      if (!(err instanceof AppError) || err.status !== 404) throw err;
      // Try to remove from recent list anyway if it is there
      await db
        .prepare('DELETE FROM recent_documents WHERE userId = ? AND documentId = ?')
        .bind(user.id, docId)
        .run();
      return c.json({ message: 'Document not found', action: 'removed' }, 404);
    }

    if (!access.isOwner && access.role === 'editor') {
      // If collaborator, just remove shared permission and from recent
      await db
        .prepare('DELETE FROM document_permissions WHERE documentId = ? AND userId = ?')
        .bind(docId, user.id)
        .run();
      await db
        .prepare('DELETE FROM recent_documents WHERE userId = ? AND documentId = ?')
        .bind(user.id, docId)
        .run();
      return c.json({ message: 'Removed from your drive', action: 'removed' });
    }

    if (!access.isOwner) {
      return c.json({ message: 'Only the document owner can delete this document' }, 403);
    }

    // Permanently delete document and all cascade references
    await db.prepare('DELETE FROM documents WHERE id = ?').bind(docId).run();
    await db.prepare('DELETE FROM document_pages WHERE documentId = ?').bind(docId).run();
    await db.prepare('DELETE FROM document_permissions WHERE documentId = ?').bind(docId).run();
    await db.prepare('DELETE FROM recent_documents WHERE documentId = ?').bind(docId).run();
    await db.prepare('DELETE FROM document_history WHERE documentId = ?').bind(docId).run();

    return c.json({ message: 'Document deleted', action: 'deleted' });
  });

  app.post('/api/documents/:id/transfer', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const docId = validateUuid(c.req.param('id'), 'document id');
    const { newOwnerUsername } = await readJson(c, LIMITS.authBody);
    const trimmedNewOwnerUsername = validateUsername(newOwnerUsername);

    const access = await getDocumentAccess(db, docId, user.id);
    assertDocumentOwner(access);

    const newOwner = await db
      .prepare('SELECT id FROM users WHERE username = ?')
      .bind(trimmedNewOwnerUsername)
      .first();
    if (!newOwner) {
      return c.json({ message: 'User not found' }, 404);
    }

    if (newOwner.id === user.id) {
      return c.json({ message: 'You are already the owner of this document' }, 400);
    }

    // Transfer ownership
    await db.prepare('UPDATE documents SET owner = ? WHERE id = ?').bind(newOwner.id, docId).run();

    // Add old owner to permissions so they retain editor access
    await db
      .prepare(
        "INSERT OR REPLACE INTO document_permissions (documentId, userId, role) VALUES (?, ?, 'editor')"
      )
      .bind(docId, user.id)
      .run();

    // Remove new owner from permissions list
    await db
      .prepare('DELETE FROM document_permissions WHERE documentId = ? AND userId = ?')
      .bind(docId, newOwner.id)
      .run();

    await logHistory(
      db,
      docId,
      user.id,
      user.username,
      `Transferred ownership to ${trimmedNewOwnerUsername}`
    );

    return c.json({
      message: `Ownership transferred to ${trimmedNewOwnerUsername}`,
    });
  });

  app.get('/api/documents/:id/history', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const docId = validateUuid(c.req.param('id'), 'document id');
    const access = await getDocumentAccess(db, docId, user.id);
    assertDocumentReadable(access);

    const history = await db
      .prepare(
        'SELECT id, documentId, userId, username, action, details, timestamp FROM document_history WHERE documentId = ? ORDER BY timestamp DESC LIMIT 50'
      )
      .bind(docId)
      .all();

    return c.json(history.results || []);
  });

  app.get('/api/documents/:id/info', authenticateUser, requireVerifiedAuth, async (c) => {
    const db = requireDb(c.env);
    const user = c.get('user');
    const docId = validateUuid(c.req.param('id'), 'document id');
    const access = await getDocumentAccess(db, docId, user.id);
    assertDocumentReadable(access);

    return c.json({
      title: access.doc.title,
      isOwner: access.isOwner,
      isShared: access.role === 'editor',
      canEdit: access.canEdit,
    });
  });
}
