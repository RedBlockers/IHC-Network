const jwt = require("jsonwebtoken");

const CreateToken = (userId, passwordUpdatedAt) => {
    return jwt.sign({ userId, passwordUpdatedAt }, process.env.SECRET_KEY, {
        expiresIn: "7d",
    });
};

module.exports = { CreateToken };
