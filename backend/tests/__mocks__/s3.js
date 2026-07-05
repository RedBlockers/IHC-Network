// Mock CJS du client S3 (le vrai s3.js utilise import/export ESM incompatible avec Jest)
module.exports = { s3: null };
