const authRoutes = require('./auth');
const userRoutes = require('./user');
const documentRoutes = require('./document');

const setupRoutes = (app) => {
    app.use('/api/auth', authRoutes);
    app.use('/api/user', userRoutes);
    app.use('/api/documents', documentRoutes);
};

module.exports = setupRoutes;
