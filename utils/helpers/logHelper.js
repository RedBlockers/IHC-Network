const logger = require("../logger");

const logDB = (op, table, startTime, success, summary, error = null) => {
    const duration = Date.now() - startTime;

    const logData = {
        event: success ? "DBQuery" : "DBError",
        operation: op,
        table: table,
        querySummary: summary,
        duration: `${duration}ms`,
        success: success,
    };

    if (!success && error) {
        logData.errorMessage = error.message;
        logData.stack = error.stack;
        logger.error(logData);
    } else {
        logger.debug(logData);
    }
};

const logAPI = (method, endpoint, startTime, success, error = null) => {
    const duration = Date.now() - startTime;

    const logData = {
        event: success ? "APIRequest" : "APIError",
        method: method,
        endpoint: endpoint,
        duration: `${duration}ms`,
        success: success,
    };

    if (!success && error) {
        logData.errorMessage = error.message;
        logData.stack = error.stack;
        logger.error(logData);
    } else {
        logger.info(logData);
    }
};

module.exports = { logDB, logAPI };
