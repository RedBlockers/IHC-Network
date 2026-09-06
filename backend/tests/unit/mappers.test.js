"use strict";

const mappers = require("../../src/domain/mappers");

describe("mappers", () => {
    const row = {
        userId: 5,
        handle: "ada",
        displayName: "Ada",
        avatar: "/a.webp",
        aboutMe: "hi",
        presence: "online",
        isBot: 0,
        email: "ada@example.com",
        password: "$2b$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        isEmailVerified: 1,
        isBanned: 0,
    };

    it("toPublicUser ne divulgue jamais email ni mot de passe", () => {
        const dto = mappers.toPublicUser(row);
        expect(dto).not.toHaveProperty("email");
        expect(dto).not.toHaveProperty("password");
        expect(dto.isBot).toBe(false);
    });

    it("toPrivateUser expose l'email au propriétaire mais jamais le hash", () => {
        const dto = mappers.toPrivateUser(row);
        expect(dto.email).toBe("ada@example.com");
        expect(dto).not.toHaveProperty("password");
        expect(dto.isEmailVerified).toBe(true);
    });

    it("toMessage conserve l'ID Snowflake sous forme de chaîne", () => {
        const dto = mappers.toMessage({
            messageId: "7168291357943578624",
            channelId: 3,
            content: "yo",
            createdAt: new Date(),
            userId: 5,
            handle: "ada",
            displayName: "Ada",
            avatar: "/a.webp",
        });
        expect(dto.messageId).toBe("7168291357943578624");
        expect(typeof dto.messageId).toBe("string");
    });

    it("distingue un bot d'un webhook", () => {
        const bot = mappers.toMessage({
            messageId: "1",
            channelId: 3,
            content: "prêt",
            createdAt: new Date(),
            userId: 5,
            handle: "ada",
            displayName: "Ada",
            botName: "Veilleur",
        });
        expect(bot.author.isBot).toBe(true);
        expect(bot.author.isWebhook).toBe(false);
        expect(bot.author.displayName).toBe("Veilleur");

        const hook = mappers.toMessage({
            messageId: "2",
            channelId: 3,
            content: "déployé",
            createdAt: new Date(),
            userId: 5,
            handle: "ada",
            displayName: "Ada",
            webhookName: "CI",
        });
        expect(hook.author.isWebhook).toBe(true);
        expect(hook.author.isBot).toBe(false);
        expect(hook.author.displayName).toBe("CI");
    });

    it("renvoie null sur une ligne absente", () => {
        expect(mappers.toPublicUser(null)).toBeNull();
        expect(mappers.toGuild(undefined)).toBeNull();
    });
});
