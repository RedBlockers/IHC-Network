const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const logger = require("../utils/logger");
const { s3 } = require("./s3.js");
const {
    PutObjectCommand,
    CopyObjectCommand,
    DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

async function saveTempAvatar(file) {
    try {
        key = `temp/avatar/${crypto.randomUUID()}.${file.mimetype.split("/")[1]}`;

        await s3.send(
            new PutObjectCommand({
                Bucket: process.env.S3_BUCKET,
                Key: key,
                Body: file.buffer,
                ACL: "public-read",
            })
        );
        logger.info(
            `Avatar de l'utilisateur sauvegardé avec succès dans S3 à l'emplacement: ${key}`
        );
        return `${process.env.S3_URL}:${process.env.S3_PORT}/${process.env.S3_BUCKET}/${key}`;
    } catch (error) {
        logger.error(
            `Echec de la sauvegarde de l'avatar de l'utilisateur  dans S3. ${error.stack}`
        );
        return null;
    }
}

async function deleteTempAvatar(key) {
    try {
        await s3.send(
            new DeleteObjectCommand({
                Bucket: process.env.S3_BUCKET,
                Key: key,
            })
        );
        logger.info(
            `Avatar de l'utilisateur supprimé avec succès de S3 à l'emplacement: ${key}`
        );
    } catch (error) {
        logger.error(
            `Echec de la suppression de l'avatar de l'utilisateur  dans S3. ${error.message}`
        );
    }
}

async function copyTempAvatar(sourceKey, destinationKey) {
    try {
        await s3.send(
            new CopyObjectCommand({
                Bucket: process.env.S3_BUCKET,
                CopySource: `${process.env.S3_BUCKET}/${sourceKey}`,
                Key: destinationKey,
                ACL: "public-read",
            })
        );
        logger.info(
            `Avatar de l'utilisateur copié avec succès dans S3 de ${sourceKey} à ${destinationKey}`
        );
        return `${process.env.S3_URL}:${process.env.S3_PORT}/${process.env.S3_BUCKET}/${destinationKey}`;
    } catch (error) {
        logger.error(
            `Echec de la copie de l'avatar de l'utilisateur  dans S3 de ${sourceKey} à ${destinationKey}. ${error.message}`
        );
        return null;
    }
}

async function saveAvatar(sourceKey, destinationKey) {
    try {
        await copyTempAvatar(sourceKey, destinationKey);
        await deleteTempAvatar(sourceKey);
        logger.info(
            `Avatar de l'utilisateur déplacé avec succès dans S3 de ${sourceKey} à ${destinationKey}`
        );
        return `${process.env.S3_URL}:${process.env.S3_PORT}/${process.env.S3_BUCKET}/${destinationKey}`;
    } catch (error) {
        logger.error(
            `Echec du déplacement de l'avatar de l'utilisateur  dans S3 de ${sourceKey} à ${destinationKey}. ${error.message}`
        );
        return null;
    }
}

async function saveGuildIcon(file) {
    try {
        const ext = file.mimetype.split("/")[1];
        const key = `guilds/${crypto.randomUUID()}/icon.${ext}`;
        await s3.send(
            new PutObjectCommand({
                Bucket: process.env.S3_BUCKET,
                Key: key,
                Body: file.buffer,
                ACL: "public-read",
            })
        );
        logger.info(`Icône de guilde sauvegardée dans S3: ${key}`);
        return `${process.env.S3_URL}:${process.env.S3_PORT}/${process.env.S3_BUCKET}/${key}`;
    } catch (error) {
        logger.error(`Échec de la sauvegarde de l'icône de guilde dans S3. ${error.stack}`);
        return null;
    }
}

module.exports = {
    saveTempAvatar,
    saveAvatar,
    saveGuildIcon,
};
