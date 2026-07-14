export function registerRealtimeRoutes(app, dependencies) {
  const {
    AppError,
    assertDocumentReadable,
    getDocumentAccess,
    requireDb,
    requireDurableObject,
    requireJwtSecret,
    requireVerifiedUser,
    validateUuid,
    verify,
  } = dependencies;

  app.get('/ws/:documentId', async (c) => {
    // Task 1: Require a genuine WebSocket upgrade — return 426 otherwise.
    const upgrade = c.req.header('Upgrade');
    if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
      console.log('[WS] Non-upgrade request rejected (missing Upgrade header)');
      return c.json({ error: 'Expected WebSocket upgrade', code: 'upgrade_required' }, 426);
    }

    const documentId = validateUuid(c.req.param('documentId'), 'document id');
    const ticket = c.req.query('ticket');

    console.log('[WS] Route hit', {
      documentId,
      hasTicket: Boolean(ticket),
    });

    // Task 2: Require a ticket — do not expose its value in logs.
    if (!ticket) {
      console.log('[WS] Rejected: missing ticket for doc', documentId);
      return c.json({ error: 'WebSocket ticket required', code: 'ticket_required' }, 401);
    }

    // Task 3: Validate the ticket at the Worker level.
    const jwtSecret = requireJwtSecret(c.env);
    let ticketPayload;
    try {
      ticketPayload = await verify(ticket, jwtSecret, 'HS256');
    } catch {
      console.log('[WS] Rejected: invalid or expired ticket for doc', documentId);
      return c.json({ error: 'Invalid or expired ticket', code: 'invalid_ticket' }, 401);
    }

    if (!ticketPayload || ticketPayload.type !== 'ws-ticket') {
      console.log('[WS] Rejected: ticket type mismatch for doc', documentId);
      return c.json({ error: 'Invalid ticket type', code: 'invalid_ticket' }, 401);
    }

    // Task 4: Check document read permission before forwarding to DO.
    const db = requireDb(c.env);
    try {
      await requireVerifiedUser(c.env, ticketPayload.sub);
      const access = await getDocumentAccess(db, documentId, ticketPayload.sub);
      assertDocumentReadable(access);
      console.log('[WS] Permission granted', {
        documentId,
        userId: ticketPayload.sub,
        canEdit: access.canEdit,
      });
    } catch (err) {
      console.log('[WS] Permission denied', {
        documentId,
        userId: ticketPayload.sub,
        reason: err instanceof AppError ? err.message : 'unknown',
      });
      if (err instanceof AppError) {
        return c.json({ error: err.message, code: err.code }, err.status);
      }
      return c.json({ error: 'Access denied', code: 'access_denied' }, 403);
    }

    // Task 5: Forward the original request (with all headers intact) to the Durable Object.
    const binding = requireDurableObject(c.env, 'DOCUMENT_SYNC_OBJECT');
    const id = binding.idFromName(documentId);
    const stub = binding.get(id);
    const doResponse = await stub.fetch(c.req.raw);

    console.log('[WS] DO response status', doResponse.status, 'for doc', documentId);

    return doResponse;
  });
}
