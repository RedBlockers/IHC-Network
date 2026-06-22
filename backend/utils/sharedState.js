// sharedState.js
let io = null;
const connectedUsers = new Map();

module.exports = {
    setIo: (instance) => {
        io = instance;
    },
    getIo: () => io,
    connectedUsers,
};
