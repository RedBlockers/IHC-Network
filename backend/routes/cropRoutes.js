const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const { logAPI } = require("../utils/helpers/logHelper");

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Type non supporté : ${file.mimetype}`));
        }
    },
});

router.post("/crop", upload.single("image"), async (req, res) => {
    const startTime = Date.now();
    try {
        if (!req.file) {
            logAPI(req.method, req.path, 400, startTime, false, "Aucun fichier fourni");
            return res.status(400).json({ error: "Aucun fichier fourni." });
        }

        const { x, y, width, height } = req.body;

        if ([x, y, width, height].some((v) => v === undefined || v === "")) {
            logAPI(req.method, req.path, 400, startTime, false, "Coordonnées de crop manquantes");
            return res.status(400).json({ error: "Coordonnées de crop manquantes (x, y, width, height)." });
        }

        const cropRegion = {
            left:   Math.max(0, Math.round(Number(x))),
            top:    Math.max(0, Math.round(Number(y))),
            width:  Math.round(Number(width)),
            height: Math.round(Number(height)),
        };

        if (cropRegion.width <= 0 || cropRegion.height <= 0) {
            logAPI(req.method, req.path, 400, startTime, false, "Dimensions de crop invalides");
            return res.status(400).json({ error: "Dimensions de crop invalides." });
        }

        const mime   = req.file.mimetype;
        const isGif  = mime === "image/gif";
        const isWebp = mime === "image/webp";

        let pipeline = sharp(req.file.buffer, { animated: isGif || isWebp }).extract(cropRegion);

        if      (isGif)               pipeline = pipeline.gif();
        else if (isWebp)              pipeline = pipeline.webp();
        else if (mime === "image/png") pipeline = pipeline.png();
        else                          pipeline = pipeline.jpeg({ quality: 90 });

        const croppedBuffer = await pipeline.toBuffer();

        logAPI(req.method, req.path, 200, startTime, true);
        res.set("Content-Type", mime);
        res.set("Content-Disposition", "inline");
        res.send(croppedBuffer);
    } catch (err) {
        if (err.message.includes("extract_area")) {
            logAPI(req.method, req.path, 400, startTime, false, "Zone de crop hors limites");
            return res.status(400).json({
                error: "La zone de crop dépasse les dimensions de l'image originale.",
            });
        }
        logAPI(req.method, req.path, 500, startTime, false, err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
