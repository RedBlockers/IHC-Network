import Auth from "../services/auth.js"; // adapte le chemin selon ton projet

//const api = axios.create({
//    baseURL: "/",
//    timeout: 10000,
//});
//
//api.interceptors.request.use((config) => {
//    const token = localStorage.getItem("token");
//    if (token) {
//        config.headers["Authorization"] = `Bearer ${token}`;
//    }
//    return config;
//});

async function safeRequest(promiseFn) {
    try {
        const response = await promiseFn();
        return { success: true, data: response.data };
    } catch (error) {
        const status = error.response?.status;
        if (status === 401) {
            Auth.invalidateToken();
        }

        console.error("Erreur API :", error);
        return {
            success: false,
            message:
                error.response?.data?.message ||
                "Une erreur est survenue lors de l’appel API.",
        };
    }
}

export { safeRequest };
