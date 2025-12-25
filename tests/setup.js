const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { server } = require('../src/server');
const User = require('../src/models/User');
const Document = require('../src/models/Document');
const History = require('../src/models/History');

let mongoServer;

beforeAll(async () => {
  if (process.env.SKIP_DB_SETUP) return;

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
});

afterAll(async () => {
  if (process.env.SKIP_DB_SETUP) return;

  await mongoose.connection.close();
  if (mongoServer) {
    await mongoServer.stop();
  }
  if (server.listening) {
      server.close();
  }
});

beforeEach(async () => {
  if (process.env.SKIP_DB_SETUP) return;

  if (mongoose.connection.readyState !== 0) {
      await User.deleteMany({});
      await Document.deleteMany({});
      await History.deleteMany({});
  }
});