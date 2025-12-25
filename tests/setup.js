// tests/setup.js

// Check if we are in a Node.js environment (Backend Tests)
// In jsdom (Frontend Tests), window is defined.
const isNodeEnv = typeof window === 'undefined';

let mongoose;
let MongoMemoryServer;
let server;
let User;
let Document;
let History;
let mongoServer;

if (isNodeEnv) {
  mongoose = require('mongoose');
  MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
  // We mock server require to avoid starting it immediately if possible, 
  // but here we just require it.
  const serverModule = require('../src/server');
  server = serverModule.server;
  User = require('../src/models/User');
  Document = require('../src/models/Document');
  History = require('../src/models/History');
} else {
    // Frontend Test Environment Setup
    window.testEnv = true;
}

beforeAll(async () => {
  if (!isNodeEnv || process.env.SKIP_DB_SETUP) return;

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
});

afterAll(async () => {
  if (!isNodeEnv || process.env.SKIP_DB_SETUP) return;

  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
  if (server && server.listening) {
      server.close();
  }
});

beforeEach(async () => {
  if (!isNodeEnv || process.env.SKIP_DB_SETUP) return;

  if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await Document.deleteMany({});
      await History.deleteMany({});
  }
});