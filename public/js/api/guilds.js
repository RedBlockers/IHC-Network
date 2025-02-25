export async function getGuilds(token) {
    const response = await axios.post("/guilds/getGuilds", { token: token });
    if (response.status == 401) {
        localStorage.removeItem("token");
        window.location.href = "pages/login.html";
    } else if (response.status == 200) {
        console.log(response.data);
        return response.data;
    }
}

export async function CreateInvite(token, guildId) {
    try {
        const response = await axios.post("/guilds/createInvite", {
            token: token,
            guildId: guildId,
        });
        if (response.status == 401) {
            localStorage.removeItem("token");
            window.location.href = "pages/login.html";
        } else if (response.status == 200) {
            console.log(response.data);
            await navigator.clipboard.writeText(
                `${window.location.protocol}//${window.location.hostname}/invite/${response.data}`
            );
            window.createNotification({
                closeOnClick: true,
                displayCloseButton: true,
                positionClass: "nfc-bottom-right",
                showDuration: 3500,
                theme: "success",
            })({
                title: "Succès",
                message:
                    "Le lien d'invitation a été copié dans le presse-papier",
            });
        } else {
            console.log("response");
            window.createNotification({
                closeOnClick: true,
                displayCloseButton: true,
                positionClass: "nfc-bottom-right",
                showDuration: 3500,
                theme: "error",
            })({
                title: "Erreur",
                message:
                    "Une erreur est survenue lors de la création de l'invitation",
            });
        }
    } catch (error) {
        window.createNotification({
            closeOnClick: true,
            displayCloseButton: true,
            positionClass: "nfc-bottom-right",
            showDuration: 3500,
            theme: "error",
        })({
            title: "Erreur",
            message:
                "Une erreur est survenue lors de la création de l'invitation \n" +
                error,
        });
    }
}

export async function getInvitedByCode(token) {
    const match = window.location.pathname.match(
        "^\\/invite\\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$"
    );
    if (match) {
        const inviteCode = match[1];
        const response = await axios.post("/guilds/invite", {
            token: token,
            inviteCode: inviteCode,
        });
        if (response.status == 401) {
            localStorage.removeItem("token");
            window.location.href = "pages/login.html";
        } else if (response.status == 200) {
            return response.data;
        }
    }
}
