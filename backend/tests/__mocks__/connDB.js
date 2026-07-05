// Mock du pool MySQL — empêche toute connexion réelle pendant les tests
const mockConnection = {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
    execute: jest.fn().mockResolvedValue([[{ id: 1 }], null]),
};

module.exports = {
    promise: () => ({
        getConnection: jest.fn().mockResolvedValue(mockConnection),
        execute: jest.fn().mockResolvedValue([[], null]),
    }),
};
