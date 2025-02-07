export class Channels {
    static async getChannelsByGuildId(guildId) {
        const response = await axios.post('/channels/getChannelsByGuildId', {
            guildId: parseInt(guildId, 10),
            token: localStorage.getItem('token'),
        })

        if (response.status ===401) {
            return
        }
        else if (response.status === 200) {
            return response.data;
        }

    }
    static async getPrivateChannelsByUserId() {
        const response = await axios.post('/channels/getPrivateChannelsByUserId', {
            token: localStorage.getItem('token'),
        })

        if (response.status ===401) {
            return
        }
        else if (response.status === 200) {
            return response.data;
        }

    }
}
