const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");
const { logAPI } = require("../utils/helpers/logHelper");

const authMiddleware = async (req, res, next) => {
    const startTime = Date.now();
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        logAPI(req.method, req.path, 401, startTime, false, "Token manquant");
        return res.status(401).json({ message: "Token manquant" });
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);

        const user = await userModel.getUserById(decoded.userId);

        if (!user) {
            logAPI(req.method, req.path, 401, startTime, false, "Utilisateur non trouvé");
            return res.status(401).json({ message: "Utilisateur non trouvé" });
        }

        const dbTime = Math.floor(user.passwordUpdatedAt.getTime() / 1000);
        const tokenTime = Math.floor(
            new Date(decoded.passwordUpdatedAt).getTime() / 1000
        );

        if (dbTime !== tokenTime) {
            logAPI(req.method, req.path, 401, startTime, false, "Session expirée (mot de passe changé).");
            return res
                .status(401)
                .json({ message: "Session expirée (mot de passe changé)." });
        }

        req.user = user;
        next();
    } catch (err) {
        logAPI(req.method, req.path, 401, startTime, false, "Token invalide");
        return res.status(401).json({ message: "Token invalide" });
    }
};

module.exports = authMiddleware;
