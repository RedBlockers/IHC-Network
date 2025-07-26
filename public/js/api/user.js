import { Auth } from "../services/auth.js";

export class UserAPI {
    static async getFriends(token) {
        try {
            const response = await axios.get("/users/friends", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                Auth.invalidateToken();
            } else {
                console.error(
                    "Erreur lors de la récupération des amis :",
                    error
                );
            }
            return null;
        }
    }

    static async addFriend(token, username) {
        try {
            const response = await axios.post(
                "/users/friends",
                {
                    username: username,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                Auth.invalidateToken();
            } else if (error.response?.status === 409) {
                alert(
                    "Vous avez déjà envoyé une demande d'ami à cet utilisateur ou il vous a déjà envoyé une demande."
                );
                console.error("Amitié déjà existante ou demande en attente.");
            } else {
                console.error("Erreur lors de l'ajout d'un ami :", error);
            }
            return null;
        }
    }

    static async acceptFriend(token, friendId) {
        try {
            const response = await axios.put(
                "/users/acceptFriend",
                {
                    friendId: friendId,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                Auth.invalidateToken();
            } else {
                console.error("Erreur lors de l'acceptation de l'ami :", error);
            }
            return null;
        }
    }

    static async refuseFriend(token, friendId) {
        try {
            const response = await axios.delete("/users/removeFriend", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                data: { friendId: friendId, isSender: false },
            });
            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                Auth.invalidateToken();
            } else {
                console.error("Erreur lors du refus de l'ami :", error);
            }
            return null;
        }
    }

    static async cancelFriend(token, friendId) {
        try {
            const response = await axios.delete("/users/removeFriend", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                data: { friendId: friendId, isSender: true },
            });
            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                Auth.invalidateToken();
            } else {
                console.error(
                    "Erreur lors de l'annulation de la demande d'ami :",
                    error
                );
            }
            return null;
        }
    }

    static async removeFriend(token, friendId) {
        try {
            const response = await axios.delete("/users/removeFriend", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                data: { friendId: friendId },
            });
            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                Auth.invalidateToken();
            } else {
                console.error(
                    "Erreur lors de la suppression de l'ami :",
                    error
                );
            }
            return null;
        }
    }

    static async getUser(token, userId) {
        try {
            const response = await axios.get("/users/getUser", {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                params: {
                    userId: userId,
                },
            });
            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                Auth.invalidateToken();
            } else {
                console.error(
                    "Erreur lors de la récupération de l'utilisateur :",
                    error
                );
            }
            return null;
        }
    }
}
