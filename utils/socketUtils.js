const { getIo, connectedUsers } = require("./sharedState");

function emitToUser(userId, event, payload) {
    const socketId = connectedUsers.get(String(userId));
    if (!socketId) return false;

    const io = getIo();
    if (!io) return false;

    io.to(socketId).emit(event, payload);
    return true;
}

module.exports = {
    emitToUser,
};
