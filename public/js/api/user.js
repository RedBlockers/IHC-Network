import { Auth } from "../services/auth.js";

export class UserAPI {
    static async getFriends(token) {
        const response = await axios.post("/users/getFriends", {
            token: token,
        });
        if (response.status == 401) {
            Auth.invalidateToken();
        } else if (response.status == 200) {
            return response.data;
        }
    }

    static async addFriend(token, username) {
        const response = await axios.post("/users/addFriend", {
            token: token,
            username: username,
        });
        if (response.status == 401) {
            Auth.invalidateToken();
        }
        return response.data;
    }

    static async getFriends(token) {
        const response = await axios.post("/users/getFriends", {
            token: token,
        });
        if (response.status == 401) {
            Auth.invalidateToken();
        } else if (response.status == 200) {
            return response.data;
        }
    }

    static async acceptFriend(token, friendId) {
        const response = await axios.post("/users/acceptFriend", {
            token: token,
            friendId: friendId,
        });
        if (response.status == 401) {
            Auth.invalidateToken();
        }
        return response.data;
    }

    static async refuseFriend(token, friendId) {
        const response = await axios.delete("/users/refuseFriend", {
            data: { token: token, friendId: friendId },
        });
        if (response.status == 401) {
            Auth.invalidateToken();
        }
    }

    static async cancelFriend(token, friendId) {
        const response = await axios.delete("/users/cancelFriendRequest", {
            data: { token: token, friendId: friendId },
        });
        if (response.status == 401) {
            Auth.invalidateToken();
        }
        return response.data;
    }

    static async removeFriend(token, friendId) {
        const response = await axios.delete("/users/removeFriend", {
            data: { token: token, friendId: friendId },
        });
        if (response.status == 401) {
            Auth.invalidateToken();
        }
        return response.data;
    }
}
