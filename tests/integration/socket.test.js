const WebSocket = require('ws');
const { server } = require('../../src/server');
const mongoose = require('mongoose');
const Document = require('../../src/models/Document');
const User = require('../../src/models/User');
const { verifyTicket } = require('../../src/utils/ticketStore');

jest.mock('../../src/models/Document');
jest.mock('../../src/models/User');
jest.mock('../../src/utils/ticketStore');

// We don't mock mongoose here because we are in integration tests and setup.js handles it?
// Wait, socket.test.js WAS an integration test but it mocked everything!
// If it mocks everything, it's a UNIT test.
// But it starts the server.
// If it starts the server, it's integration.
// But it mocks models.
// So it doesn't use the DB.
// So setup.js connecting to DB is irrelevant but harmless unless it crashes.

// However, my previous socket.test.js MOCKED mongoose!
/*
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn().mockResolvedValue(actualMongoose),
    connection: {
      ...actualMongoose.connection,
      readyState: 1,
      close: jest.fn().mockResolvedValue(true),
    },
  };
});
*/

// If I mock mongoose, setup.js fails because it tries to call real mongoose methods (if it imports real mongoose).
// setup.js uses `require('mongoose')`.
// If I use `jest.mock('mongoose')` in `socket.test.js`, Jest uses the mock for ALL requires in that test suite context.

// So `socket.test.js` SHOULD be a unit test or needs to NOT mock mongoose connection if it runs with setup.js.
// Since it mocks the DB logic, it doesn't need the DB.
// I will place it in `tests/unit`? No, it starts the server.
// I will place it in `tests/integration` but ensure it works.

// Actually, `socket.test.js` tests the WebSocket handshake.
// I can implement it without starting the full express server if I just test the upgrade handler, but that's hard.
// I will keep it as is, but I need to handle the `setup.js` conflict.

// If I set SKIP_DB_SETUP for this test, it solves it.
// But I can't set env var per file easily.

// I will make `socket.test.js` NOT mock mongoose connection, but use the in-memory DB provided by setup.js.
// This is cleaner.

describe('Socket Logic Integration Tests', () => {
  let baseUrl;
  let userId = 'user123';
  let docId = 'doc123';
  let validTicket = 'valid-ticket';

  beforeAll((done) => {
    if (!server.listening) {
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `ws://localhost:${port}`;
        done();
      });
    } else {
      const port = server.address().port;
      baseUrl = `ws://localhost:${port}`;
      done();
    }
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // We need to mock verifyTicket because we can't easily inject tickets into the store from here 
    // unless we use the real store.
    // Real store is in memory.
    // If we use real store, we can generate a ticket.
    
    verifyTicket.mockImplementation((ticket) => {
        return ticket === validTicket ? userId : null;
    });

    const mockDoc = {
      _id: docId,
      owner: userId,
      title: 'Test Doc',
      sharedWith: [],
      yjsState: null,
      save: jest.fn(),
    };
    
    Document.findById.mockResolvedValue(mockDoc);
    Document.findByIdAndUpdate.mockResolvedValue(mockDoc);
  });

  function createWebSocket(query) {
    return new WebSocket(`${baseUrl}${query}`);
  }

  it('should reject connection without ticket', (done) => {
    const ws = createWebSocket(`?documentId=${docId}`);
    ws.on('error', () => {}); 
    ws.on('close', (code) => {
       done();
    });
  });

  it('should reject connection with invalid ticket', (done) => {
    const ws = createWebSocket(`?documentId=${docId}&ticket=invalid`);
    ws.on('error', () => {});
    ws.on('close', () => {
       done();
    });
  });

  it('should accept connection with valid ticket', (done) => {
    const ws = createWebSocket(`?documentId=${docId}&ticket=${validTicket}`);
    
    ws.on('open', () => {
      ws.close();
      done();
    });
    
    ws.on('error', (err) => {
        done(err);
    });
  });
});
