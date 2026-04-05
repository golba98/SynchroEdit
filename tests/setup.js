// tests/setup.js

// Check if we are in a Node.js environment (Backend Tests)
// In jsdom (Frontend Tests), window is defined.
const isNodeEnv = typeof window === 'undefined';

if (isNodeEnv) {
  // Mock CSRF protection for backend integration tests
  jest.mock('../src/utils/csrf', () => require('./mocks/csrf'));
}

let mongoose;
let MongoMemoryServer;
let server;
let User;
let Document;
let History;
let mongoServer;

if (isNodeEnv) {
  // Only load server and models if we are NOT skipping DB setup (Integration Tests)
  // For Unit Tests (SKIP_DB_SETUP=true), we want to avoid loading these to prevent 
  // module caching that interferes with mocking.
  if (!process.env.SKIP_DB_SETUP) {
    mongoose = require('mongoose');
    MongoMemoryServer = require('mongodb-memory-server').MongoMemoryServer;
    
    const serverModule = require('../src/server');
    server = serverModule.server;
    User = require('../src/users/User');
    Document = require('../src/documents/Document');
    History = require('../src/documents/History');
  }
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
