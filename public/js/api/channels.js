export class Channels {
    static async getChannelsByGuildId(guildId) {
        const response = await axios.get("/channels/getChannelsByGuildId", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            params: {
                guildId: guildId,
            },
        });

        if (response.status === 401) {
            return;
        } else if (response.status === 200) {
            return response.data;
        }
    }
    static async getPrivateChannelsByUserId() {
        const response = await axios.get(
            "/channels/getPrivateChannelsByUserId",
            {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            }
        );

        if (response.status === 401) {
            return;
        } else if (response.status === 200) {
            return response.data;
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
