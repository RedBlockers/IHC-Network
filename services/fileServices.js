const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const logger = require("../utils/logger");

async function saveImage(image, dirPath) {
    try {
        if (!image) {
            logger.error(
                "Echec de la sauvegarde de l'image. L'image n'existe pas."
            );
            return null;
        }

        // Validate base64 image format
        const base64Prefix = /^data:image\/png;base64,/;
        if (!base64Prefix.test(image)) {
            logger.error(
                "Format de l'image invalide. Attendu: data:image/png;base64"
            );
            return null;
        }

        // Generate unique filename and ensure directory exists
        const UUID = crypto.randomUUID();
        const fileName = `${UUID}.png`;
        const relativePath = path.join(dirPath, fileName);
        const fullPath = path.resolve(`./public/images/${dirPath}`, fileName);

        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });

        // Convert base64 to buffer and save the file
        const base64Data = image.replace(base64Prefix, "");
        const buffer = Buffer.from(base64Data, "base64");
        await fs.promises.writeFile(fullPath, buffer);

        logger.info(
            `Photo de profil de l'utilisateur sauvegardée avec succès à l'emplacement: ${fullPath}`
        );
        return relativePath;
    } catch (error) {
        logger.error(`Echec de la sauvegarde de l'image. ${error.message}`);
        return null;
    }
}

async function clearFiles(pathToCheck) {
    try {
        pathToCheck.forEach((path) => {
            //Faire le corps de la fonction
        });
    } catch (error) {
        logger.error(`Echec de la suppression des fichiers. ${error.message}`);
    }
}

module.exports = {
    saveImage,
};
