const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info', // Niveau de log par défaut
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/app.log' })
  ],
});

module.exports = logger;
