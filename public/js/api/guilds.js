export async function getGuildById(token, guildId) {
    try {
        const response = await axios.get("/guilds/getGuildById", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            params: {
                guildId: guildId,
            },
        });
        return response.data;
    } catch (error) {
        console.error("Erreur lors de la récupération des guildes :", error);
        if (error.response && error.response.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "pages/login.html";
        }
    }
}

export async function getGuildsByUser() {
    try {
        const response = await axios.get("/guilds/getGuildsByUser", {
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
        });
        return response.data;
    } catch (error) {
        console.error(
            "Erreur lors de la récupération des guildes de l'utilisateur :",
            error
        );
        if (error.response && error.response.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "pages/login.html";
        }
    }
}

export async function CreateInvite(token, guildId) {
    try {
        const response = await axios.post(
            "/guilds/createInvite",
            {
                // Corps de la requête (data)
                guildId: guildId,
            },
            {
                // Configuration avec les headers (3e paramètre)
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        // Le reste de votre code pour gérer la réponse
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
            message: "Le lien d'invitation a été copié dans le presse-papier",
        });
    } catch (error) {
        console.error("Erreur lors de la création de l'invitation:", error);

        // Gestion des erreurs spécifiques
        if (error.response && error.response.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "pages/login.html";
        } else {
            // Notification d'erreur générique
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
    }
}

export async function getInvitedByCode(token) {
    const inviteCode = window.location.pathname.split("/invite/")[1];
    if (!inviteCode) return;

    try {
        const response = await axios.get("/guilds/invite", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            params: {
                inviteCode,
            },
        });

        if (response.status === 200) {
            return response.data;
        } else if (response.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "pages/login.html";
        }
    } catch (error) {
        console.error("Erreur lors de la récupération de l'invitation:", error);

        if (error.response && error.response.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "pages/login.html";
        }
    }
}

export async function createGuild(guildName, guildDescription, guildImage) {
    const token = localStorage.getItem("token");
    try {
        const response = await axios.post(
            "/guilds/createGuild",
            {
                // Corps de la requête (data)
                guildName: guildName,
                guildDescription: guildDescription,
                guildImage: guildImage,
            },
            {
                // Configuration incluant les headers (config)
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        if (response.status === 201) {
            const guild = response.data.guild;
            window.location.href = `/${guild}/0`;
        } else {
            alert("Une erreur est survenue lors de la création de la guilde");
        }
    } catch (error) {
        console.error("Erreur lors de la création de la guilde:", error);

        if (error.response && error.response.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "pages/login.html";
        } else {
            alert("Une erreur est survenue lors de la création de la guilde");
        }
    }
}
