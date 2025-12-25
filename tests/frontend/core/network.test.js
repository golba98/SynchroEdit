/**
 * @jest-environment jsdom
 */

import { Network } from '/js/core/network.js';
import { Auth } from '/js/ui/auth.js';

// Mock Auth
jest.mock('/js/ui/auth.js', () => ({
  Auth: {
    getToken: jest.fn(),
  },
}));

describe('Network Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    Auth.getToken.mockReturnValue('mock-token');
  });

  describe('fetchAPI', () => {
    it('should add authorization header and content type', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await Network.fetchAPI('/api/test', { method: 'POST', body: '{}' });

      expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        }),
      }));
    });

    it('should throw error on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(Network.fetchAPI('/api/test')).rejects.toThrow('API error: 500');
    });
  });

  describe('initWebSocket', () => {
    let mockWebSocket;

    beforeEach(() => {
      mockWebSocket = {
        send: jest.fn(),
        close: jest.fn(),
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null,
      };
      global.WebSocket = jest.fn(() => mockWebSocket);
    });

    it('should initialize WebSocket connection', () => {
      const onMessage = jest.fn();
      const onStatusChange = jest.fn();

      Network.initWebSocket('doc1', onMessage, onStatusChange);

      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost');
      
      // Simulate Open
      mockWebSocket.onopen();
      expect(onStatusChange).toHaveBeenCalledWith('connected');
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({
        type: 'join-document',
        documentId: 'doc1',
        token: 'mock-token',
      }));
    });

    it('should handle incoming messages', () => {
      const onMessage = jest.fn();
      Network.initWebSocket('doc1', onMessage);

      const message = { type: 'test', data: 'hello' };
      mockWebSocket.onmessage({ data: JSON.stringify(message) });

      expect(onMessage).toHaveBeenCalledWith(message);
    });
  });
});
