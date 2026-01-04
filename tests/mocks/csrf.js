exports.doubleCsrfProtection = (req, res, next) => next();
exports.generateToken = (req, res) => 'mock-csrf-token';
