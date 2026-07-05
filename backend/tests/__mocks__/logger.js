// Mock silencieux du logger Winston — supprime les logs pendant les tests
module.exports = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
};
