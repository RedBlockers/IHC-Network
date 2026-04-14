const guildModel = require("../models/guildModel");

const checkGuildMembership = async (req, res, next) => {
    try {
        const { guildId } = req.params || req.body;
        const userId = req.user.userId;

        const isMember = await guildModel.isUserInGuild(userId, guildId);

        if (isMember) return next();

        return res
            .status(403)
            .json({ message: "Accès refusé : non membre de la guilde" });
    } catch (err) {
        console.error(
            "Erreur dans le middleware de vérification de l'appartenance à la guilde :",
            err
        );
        return res.status(500).json({ message: "Erreur interne du serveur" });
    }
};

module.exports = checkGuildMembership;
