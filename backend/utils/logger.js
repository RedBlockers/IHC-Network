const { createLogger, format, transports } = require("winston");

const logger = createLogger({
    level: "debug",
    format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.splat(),
        format.printf(({ timestamp, level, message, ...meta }) => {
            // Si message est un objet, on l'affiche en JSON
            if (typeof message === "object") {
                return `${timestamp} [${level.toUpperCase()}]: ${JSON.stringify(
                    message,
                    null,
                    2
                )}`;
            }

            // Si on a des métadonnées supplémentaires, on les ajoute
            const metaString = Object.keys(meta).length
                ? `\n${JSON.stringify(meta, null, 2)}`
                : "";

            return `${timestamp} [${level.toUpperCase()}]: ${message}${metaString}`;
        })
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: "logs/app.log" }),
    ],
});

module.exports = logger;
