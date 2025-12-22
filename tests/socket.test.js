const WebSocket = require('ws');
const { server } = require('../src/server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Document = require('../src/models/Document');
const User = require('../src/models/User');

jest.mock('../src/models/Document');
jest.mock('../src/models/User');
jest.mock('jsonwebtoken');
jest.mock('mongoose', () => {
    const actualMongoose = jest.requireActual('mongoose');
    return {
        ...actualMongoose,
        connect: jest.fn().mockResolvedValue(actualMongoose),
        connection: {
            ...actualMongoose.connection,
            readyState: 1,
            close: jest.fn().mockResolvedValue(true)
        }
    };
});

const JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

describe('Socket Logic Integration Tests', () => {
    let baseUrl;
    let token = 'mock-token';
    let userId = new mongoose.Types.ObjectId().toString();
    let docId = new mongoose.Types.ObjectId().toString();

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
        await new Promise(resolve => server.close(resolve));
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
        jwt.verify.mockReturnValue({ id: userId, username: 'testuser' });
        
        const mockUserLean = { 
            _id: userId, 
            username: 'testuser', 
            profilePicture: null,
            recentDocuments: [] 
        };
        
        User.findById.mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockUserLean)
            })
        });

        const mockDocLean = {
            _id: docId,
            owner: userId,
            title: 'Test Doc',
            pages: [{ content: '' }],
            borders: { style: 'solid', width: '1pt', color: '#333333', type: 'box' },
            sharedWith: []
        };

        // documentSocket.js uses findById in two ways:
        // 1. await Document.findById(documentId)
        // 2. Document.findById(documentId).select('owner sharedWith').lean()
        
        const findByIdQueryMock = {
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(mockDocLean),
            then: jest.fn(function(resolve) {
                return Promise.resolve(mockDocLean).then(resolve);
            }),
            catch: jest.fn().mockReturnThis()
        };

        Document.findById.mockReturnValue(findByIdQueryMock);
        Document.findByIdAndUpdate.mockReturnValue(Promise.resolve(mockDocLean));
        
        // Mock logHistory to avoid undefined errors
        require('../src/utils/history').logHistory = jest.fn();
    });

    function createWebSocket() {
        return new WebSocket(baseUrl);
    }

    it('should allow a user to join a document', (done) => {
        const ws = createWebSocket();

        ws.on('open', () => {
            ws.send(JSON.stringify({
                type: 'join-document',
                documentId: docId,
                token: token
            }));
        });

        ws.on('message', (message) => {
            const data = JSON.parse(message);
            if (data.type === 'sync') {
                expect(data.data.title).toBe('Test Doc');
                ws.close();
                done();
            }
        });
    });

    it('should broadcast page updates to other clients', (done) => {
        const client1 = createWebSocket();
        const client2 = createWebSocket();
        let client1Joined = false;
        let client2Joined = false;

        const checkJoined = () => {
            if (client1Joined && client2Joined) {
                client1.send(JSON.stringify({
                    type: 'update-page',
                    pageIndex: 0,
                    content: { ops: [{ insert: 'Hello world' }] }
                }));
            }
        };

        client1.on('open', () => {
            client1.send(JSON.stringify({ type: 'join-document', documentId: docId, token }));
        });

        client2.on('open', () => {
            client2.send(JSON.stringify({ type: 'join-document', documentId: docId, token }));
        });

        client1.on('message', (msg) => {
            const data = JSON.parse(msg);
            if (data.type === 'sync') {
                client1Joined = true;
                checkJoined();
            }
        });

        client2.on('message', (msg) => {
            const data = JSON.parse(msg);
            if (data.type === 'sync') {
                client2Joined = true;
                checkJoined();
            } else if (data.type === 'update-page') {
                expect(data.content.ops[0].insert).toBe('Hello world');
                client1.close();
                client2.close();
                done();
            }
        });
    });
});
