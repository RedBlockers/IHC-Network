const jwt = require("jsonwebtoken");

const CreateToken = (userId, passwordUpdatedAt) => {
    return jwt.sign({ userId, passwordUpdatedAt }, process.env.SECRET_KEY, {
        expiresIn: "365d",
    });
};

module.exports = { CreateToken };
