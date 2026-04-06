const { MongoMemoryServer } = require('mongodb-memory-server');
const connectDB = require('../../src/config/db');

async function start() {
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'test';
  process.env.ENABLE_EMAIL_VERIFICATION = 'false';
  process.env.JWT_SECRET = 'test-secret-key-123';
  process.env.PORT = '3000';

  console.log('Starting test server with MongoMemoryServer at', uri);

  // Import the server
  const { server } = require('../../src/server');

  await connectDB();

  server.listen(3000, () => {
    console.log('Test server is listening on port 3000');
  });
}

start().catch((err) => {
  console.error('Failed to start test server:', err);
  process.exit(1);
});
