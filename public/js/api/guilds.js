export async function getGuilds(token) {
    const response = await axios.post('/guilds/getGuilds', {token: token})
    if (response.status == 401) {
        localStorage.removeItem('token');
        window.location.href = 'pages/login.html';
    }
    else if (response.status == 200) {
        console.log(response.data);
        return response.data;
    }

}