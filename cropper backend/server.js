const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const cors = require("cors");

const app = express();
const PORT = 3001;

app.use(cors({ origin: "http://localhost:5173" })); // Vite default port
app.use(express.json());

// File stored in memory (no disk write)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo max
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Type non supporté : ${file.mimetype}`));
    }
  },
});

// ─── POST /api/avatar/crop ──────────────────────────────────────────────────
// Body (multipart/form-data):
//   image  : File  — fichier original
//   x      : number — origine X du crop (px, relative à l'image originale)
//   y      : number — origine Y
//   width  : number — largeur du crop
//   height : number — hauteur du crop
//
// Réponse : buffer image du même type MIME, croppé (GIF animé préservé)
// ────────────────────────────────────────────────────────────────────────────
app.post("/api/avatar/crop", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier fourni." });
    }

    const { x, y, width, height } = req.body;

    if ([x, y, width, height].some((v) => v === undefined || v === "")) {
      return res.status(400).json({ error: "Coordonnées de crop manquantes (x, y, width, height)." });
    }

    const cropRegion = {
      left:   Math.max(0, Math.round(Number(x))),
      top:    Math.max(0, Math.round(Number(y))),
      width:  Math.round(Number(width)),
      height: Math.round(Number(height)),
    };

    if (cropRegion.width <= 0 || cropRegion.height <= 0) {
      return res.status(400).json({ error: "Dimensions de crop invalides." });
    }

    const mime     = req.file.mimetype;
    const isGif    = mime === "image/gif";
    const isWebp   = mime === "image/webp";

    // sharp({ animated: true }) traite toutes les frames du GIF/WebP animé
    let pipeline = sharp(req.file.buffer, { animated: isGif || isWebp }).extract(cropRegion);

    // On force le format de sortie pour garantir la fidélité
    if      (isGif)              pipeline = pipeline.gif();
    else if (isWebp)             pipeline = pipeline.webp();
    else if (mime === "image/png") pipeline = pipeline.png();
    else                         pipeline = pipeline.jpeg({ quality: 90 });

    const croppedBuffer = await pipeline.toBuffer();

    res.set("Content-Type", mime);
    res.set("Content-Disposition", "inline");
    res.send(croppedBuffer);

  } catch (err) {
    console.error("[crop]", err.message);

    // sharp renvoie ce message quand le crop dépasse les dimensions
    if (err.message.includes("extract_area")) {
      return res.status(400).json({
        error: "La zone de crop dépasse les dimensions de l'image originale.",
      });
    }

    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅  Serveur crop démarré → http://localhost:${PORT}`);
});
