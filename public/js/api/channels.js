export class Channels {
    static async getChannelsByGuildId(guildId) {
        try {
            const response = await axios.get("/channels/getChannelsByGuildId", {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                params: {
                    guildId: guildId,
                },
            });

            return response.data;
        } catch (error) {
            console.error(
                "Erreur lors de la récupération des canaux de la guilde :",
                error
            );
            return [];
        }
    }
    static async getPrivateChannelsByUserId() {
        try {
            const response = await axios.get(
                "/channels/getPrivateChannelsByUserId",
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem(
                            "token"
                        )}`,
                    },
                }
            );

            return response.data;
        } catch (error) {
            console.error(
                "Erreur lors de la récupération des canaux privés :",
                error
            );
            return [];
        }
    }
    static async addChannel(type, name, description, guildId) {
        axios
            .post(
                "/channels/addChannel",

                {
                    type: type,
                    name: name,
                    description: description,
                    guildId: guildId,
                },
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem(
                            "token"
                        )}`,
                    },
                }
            )
            .catch((err) => {
                console.log(err);
            });
    }
}
