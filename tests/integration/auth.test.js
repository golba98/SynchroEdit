const request = require('supertest');
const { app } = require('../../src/server');
const User = require('../../src/models/User');

describe('Auth Integration Tests', () => {
  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'TestPassword123!',
  };

  describe('POST /api/auth/signup', () => {
    it('should register a new user successfully (pending verification)', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testUser);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/receive a verification code/i);

      const user = await User.findOne({ email: testUser.email });
      expect(user).toBeTruthy();
      expect(user.isEmailVerified).toBe(false);
      expect(user.verificationCode).toBeTruthy();
    });

    it('should return 400 if password does not meet complexity requirements', async () => {
      const weakUser = {
        username: 'weakuser',
        email: 'weak@example.com',
        password: 'password123', // Missing uppercase and symbol
      };

      const res = await request(app)
        .post('/api/auth/signup')
        .send(weakUser);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/password/i);
    });

    it('should return 200 and generic message even if email already exists', async () => {
        await User.create(testUser);
  
        const res = await request(app)
          .post('/api/auth/signup')
          .send(testUser);
  
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/receive a verification code/i);
      });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should verify email with correct code', async () => {
      await request(app).post('/api/auth/signup').send(testUser);
      const user = await User.findOne({ email: testUser.email });
      
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: testUser.email,
          verificationCode: user.verificationCode,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/verified successfully/i);
      expect(res.body.token).toBeTruthy();

      const updatedUser = await User.findOne({ email: testUser.email });
      expect(updatedUser.isEmailVerified).toBe(true);
    });
  });

  describe('POST /api/auth/resend-code', () => {
    it('should resend code if user exists and is not verified', async () => {
      await request(app).post('/api/auth/signup').send(testUser);
      
      const res = await request(app)
        .post('/api/auth/resend-code')
        .send({ email: testUser.email });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/code has been sent/i);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully if verified', async () => {
      await request(app).post('/api/auth/signup').send(testUser);
      const user = await User.findOne({ email: testUser.email });
      await request(app).post('/api/auth/verify-email').send({
          email: testUser.email,
          verificationCode: user.verificationCode
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
    });

    it('should return 403 if email not verified', async () => {
        await request(app).post('/api/auth/signup').send(testUser);
  
        const res = await request(app)
          .post('/api/auth/login')
          .send({
            username: testUser.username,
            password: testUser.password,
          });
  
        expect(res.status).toBe(403);
        expect(res.body.requiresVerification).toBe(true);
      });

    it('should return 401 if password is incorrect', async () => {
        await request(app).post('/api/auth/signup').send(testUser);
        const user = await User.findOne({ email: testUser.email });
        // Verify manually to bypass check
        user.isEmailVerified = true;
        await user.save();

        const res = await request(app)
            .post('/api/auth/login')
            .send({
                username: testUser.username,
                password: 'wrongpassword'
            });
        
        expect(res.status).toBe(401);
    });

    it('should return 401 if user does not exist', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                username: 'nonexistent',
                password: 'password'
            });
        
        expect(res.status).toBe(401);
    });
  });
});
