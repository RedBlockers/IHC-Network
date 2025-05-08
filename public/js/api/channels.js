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
            .post("/channels/addChannel", {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
                type: channelType,
                name: channelName,
                description: channelDescription,
                guildId: parseInt(
                    JSON.parse(localStorage.getItem("currentSession")).guild,
                    10
                ),
            })
            .catch((err) => {
                console.log(err);
            });
    }
}
