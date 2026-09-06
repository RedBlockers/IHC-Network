"use strict";

const { z } = require("zod");

const { BadRequest } = require("../errors");

const validate = (schemas) => (req, _res, next) => {
    try {
        if (schemas.body) req.body = schemas.body.parse(req.body);
        if (schemas.params) req.params = schemas.params.parse(req.params);
        if (schemas.query) req.validatedQuery = schemas.query.parse(req.query);
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            const details = error.issues.map((issue) => ({
                path: issue.path.join(".") || "(racine)",
                message: issue.message,
            }));
            return next(new BadRequest("Données invalides.", { details }));
        }
        return next(error);
    }
};

module.exports = validate;
