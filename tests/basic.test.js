const request = require('supertest');
const { app, server } = require('../src/server');
const mongoose = require('mongoose');

describe('Basic Server Tests', () => {
    afterAll(async () => {
        await server.close();
        await mongoose.connection.close();
    });

    it('should serve the index page', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('<title>');
    });

    it('should return 404 for unknown routes', async () => {
        const res = await request(app).get('/api/unknown');
        expect(res.statusCode).toEqual(404);
    });
});
