const { z } = require("zod");

const validate = (schema) => (req, res, next) => {
    try {
        // Astuce : utilise parse sur req.body, req.params ou req.query si besoin
        req.body = schema.parse(req.body);
        next();
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({
                message: "Validation error",
                // On utilise .issues qui est le standard Zod
                errors: err.issues.map((issue) => ({
                    path: issue.path.join("."),
                    message: issue.message,
                })),
            });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = validate;
