"use strict";

const multer = require("multer");

const config = require("../config");

const { PayloadTooLarge, UnsupportedMedia, InsufficientStorage } = require("../errors");
const { humanSize } = require("../domain/filePreview");
const attachmentService = require("../services/attachmentService");

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
]);

const uploader = (files) =>
    multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: MAX_BYTES, files },
        fileFilter: (_req, file, cb) => {
            if (ACCEPTED_MIME.has(file.mimetype)) cb(null, true);
            else cb(new UnsupportedMedia(`Type de fichier non pris en charge : ${file.mimetype}.`));
        },
    });

const handleUpload =
    (handler, maxBytes = MAX_BYTES) =>
    (req, res, next) =>
        handler(req, res, (error) => {
            if (!error) return next();
            if (error instanceof multer.MulterError) {
                if (error.code === "LIMIT_FILE_SIZE")
                    return next(
                        new PayloadTooLarge(`Fichier trop volumineux. Limite par fichier : ${humanSize(maxBytes)}.`, {
                            details: { maxBytes },
                        })
                    );
                return next(new UnsupportedMedia("Envoi de fichier invalide."));
            }
            if (["ENOSPC", "EDQUOT"].includes(error.code)) {
                return next(
                    new InsufficientStorage("Le serveur n’a plus d’espace disponible pour recevoir ce fichier.")
                );
            }
            return next(error);
        });

const uploadImage = (field) => handleUpload(uploader(1).single(field));
const uploadImages = (fields) =>
    handleUpload(uploader(fields.length).fields(fields.map((name) => ({ name, maxCount: 1 }))));

const parseAttachment = handleUpload(
    multer({
        storage: multer.diskStorage({
            destination: (req, _file, callback) => callback(null, req.uploadReservation.directory),
        }),
        limits: { fileSize: config.MAX_ATTACHMENT_BYTES, files: 1, fields: 1, fieldSize: 2048 },
    }).single("file"),
    config.MAX_ATTACHMENT_BYTES
);

const uploadAttachment = async (req, res, next) => {
    let reservation;
    try {
        reservation = await attachmentService.reserveUpload(req.channel, req.headers["content-length"]);
        Object.assign(req, { uploadReservation: reservation });
        if (req.destroyed || res.destroyed) {
            await reservation.release();
            return;
        }
        res.once("close", () => {
            reservation.controller.abort();
            if (reservation.phase === "parsed") void reservation.release();
        });
        reservation.controller.signal.addEventListener(
            "abort",
            () => {
                if (reservation.phase === "receiving" && !req.destroyed) req.destroy();
            },
            { once: true }
        );
        parseAttachment(req, res, async (error) => {
            if (error || !req.file || res.destroyed) {
                await reservation.release();
                if (!res.destroyed) next(error);
                return;
            }
            reservation.phase = "parsed";
            req.file.uploadReservation = reservation;
            next();
        });
    } catch (error) {
        await reservation?.release();
        next(error);
    }
};

module.exports = { uploadImage, uploadImages, uploadAttachment, MAX_BYTES };
