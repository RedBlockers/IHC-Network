const fs = require('fs');
const crypto = require('crypto');
const logger = require('../utils/logger');
function saveProfileImage(profileImage) {
    try {
        const UUID = crypto.randomUUID();
        let imagePath = `./NoScord.jpg`; // Chemin par défaut
      
        if (profileImage) {
          const base64Data = profileImage.replace(/^data:image\/png;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          imagePath = `profiles/${UUID}.png`;
      
          fs.writeFile(`./public/images/${imagePath}`, buffer, (err) => {
            if (err) {
              console.error('Erreur lors de l\'écriture de l\'image:', err);
              throw new Error('Erreur lors de l\'écriture de l\'image.');
            }
          });
        }
        logger.info(`Image saved as ${imagePath}`);
        return imagePath;
    } catch (error) {
        logger.error(error);
    }

}

module.exports = { saveProfileImage };
