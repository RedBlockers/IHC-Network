"use strict";

const { AppError, NotFound } = require("../errors");
const { DUPLICATE_ENTRY } = require("../db/pool");
const { logger, serializeError } = require("../logger");

function notFoundHandler(req, _res, next) {
    next(new NotFound(`Route introuvable : ${req.method} ${req.path}`));
}

function errorHandler(error, req, res, _next) {
    let appError = error;
    if (error?.code === DUPLICATE_ENTRY) {
        appError = new AppError("Cette ressource existe déjà.", { status: 409, code: "conflict", cause: error });
    }

    const status = appError instanceof AppError ? appError.status : 500;

    if (status >= 500) {
        logger.error("erreur non gérée", { method: req.method, path: req.path, error: serializeError(appError) });
    } else {
        logger.warn("requête rejetée", { method: req.method, path: req.path, status, code: appError.code });
    }

    const expose = appError instanceof AppError && appError.expose;
    res.status(status).json({
        error: {
            code: expose ? appError.code : "internal_error",
            message: expose ? appError.message : "Une erreur interne est survenue.",
            requestId: req.id,
            ...(expose && appError.details ? { details: appError.details } : {}),
        },
    });
}

module.exports = { notFoundHandler, errorHandler };
