module.exports = {
    testEnvironment: "node",
    testMatch: ["**/tests/**/*.test.js"],
    verbose: true,
    moduleNameMapper: {
        // Empêche les tentatives de connexion MySQL pendant les tests
        "^.+/models/connDB$": "<rootDir>/tests/__mocks__/connDB.js",
        // Supprime les logs Winston et la création de fichiers de log
        "^.+/utils/logger$": "<rootDir>/tests/__mocks__/logger.js",
    },
};
