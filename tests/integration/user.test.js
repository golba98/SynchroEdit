const request = require('supertest');
const { app } = require('../../src/server');
const User = require('../../src/models/User');

describe('User Integration Tests', () => {
  let token;
  const testUser = {
    username: 'testuser_user',
    email: 'test_user@example.com',
    password: 'password123',
  };

  beforeEach(async () => {
    await request(app).post('/api/auth/signup').send(testUser);
    const user = await User.findOne({ email: testUser.email });
    
    const verifyRes = await request(app).post('/api/auth/verify-email').send({
      email: testUser.email,
      verificationCode: user.verificationCode
    });
    token = verifyRes.body.token;
  });

  describe('GET /api/user/profile', () => {
    it('should get user profile when authenticated', async () => {
      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(testUser.email);
    });

    it('should return 401 if unauthenticated', async () => {
        const res = await request(app).get('/api/user/profile');
        expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/user/profile', () => {
    it('should update user profile successfully', async () => {
      const updatedData = {
        accentColor: '#ff0000'
      };

      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updatedData);

      expect(res.status).toBe(200);
      expect(res.body.accentColor).toBe(updatedData.accentColor);
    });
  });

  describe('PUT /api/user/password', () => {
    it('should update password successfully', async () => {
      const passwordData = {
        currentPassword: testUser.password,
        newPassword: 'newpassword123'
      };

      const res = await request(app)
        .put('/api/user/password')
        .set('Authorization', `Bearer ${token}`)
        .send(passwordData);

      expect(res.status).toBe(200);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'newpassword123',
        });
      expect(loginRes.status).toBe(200);
    });

    it('should fail if current password is wrong', async () => {
        const passwordData = {
            currentPassword: 'wrong',
            newPassword: 'new'
        };
        const res = await request(app)
            .put('/api/user/password')
            .set('Authorization', `Bearer ${token}`)
            .send(passwordData);
        expect(res.status).toBe(400); // Or 401 depending on implementation
    });
  });
});