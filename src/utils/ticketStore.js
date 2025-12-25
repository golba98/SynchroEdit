const crypto = require('crypto');

const tickets = new Map();

/**
 * Creates a one-time use ticket for WebSocket authentication.
 * @param {string} userId
 * @returns {string} The ticket
 */
exports.createTicket = (userId) => {
  const ticket = crypto.randomBytes(16).toString('hex');
  // Expires in 30 seconds
  const expires = Date.now() + 30000;
  tickets.set(ticket, { userId, expires });
  
  // Cleanup
  setTimeout(() => tickets.delete(ticket), 30000);
  
  return ticket;
};

/**
 * Verifies and consumes a ticket.
 * @param {string} ticket
 * @returns {string|null} userId if valid, null otherwise
 */
exports.verifyTicket = (ticket) => {
  const data = tickets.get(ticket);
  if (!data) return null;
  
  tickets.delete(ticket); // One-time use
  
  if (Date.now() > data.expires) return null;
  
  return data.userId;
};
