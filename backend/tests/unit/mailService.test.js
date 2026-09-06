"use strict";

jest.mock("../../src/config", () => ({
    SMTP_HOST: "",
    SMTP_PORT: "",
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    PUBLIC_URL: "",
    CORS_ORIGIN: ["https://community.example"],
    MAIL_FROM: "Qweillo <contact@example.org>",
}));
jest.mock("../../src/logger", () => ({
    logger: { warn: jest.fn(), error: jest.fn() },
    serializeError: (error) => ({ message: error.message }),
}));
jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

const config = require("../../src/config");
const { logger } = require("../../src/logger");
const nodemailer = require("nodemailer");
const mailService = require("../../src/services/mailService");

const user = { email: "camille@example.org", displayName: "Camille" };

it("ne divulgue ni le destinataire ni le lien de récupération lorsque le courrier est indisponible", async () => {
    const result = await mailService.sendPasswordReset(user, "private-recovery-token");
    expect(result.delivered).toBe(false);
    expect(logger.warn).toHaveBeenCalled();
    const output = JSON.stringify(logger.warn.mock.calls);
    expect(output).not.toContain(user.email);
    expect(output).not.toContain("private-recovery-token");
});

it("utilise l'origine publique configurée pour les liens et interdit les fichiers et URL dans les courriers", async () => {
    config.SMTP_HOST = "mail.example.org";
    config.SMTP_PORT = "587";
    const sendMail = jest.fn().mockResolvedValue({});
    nodemailer.createTransport.mockReturnValue({ sendMail });
    expect((await mailService.sendVerification(user, "verification-token")).delivered).toBe(true);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
            disableFileAccess: true,
            disableUrlAccess: true,
        })
    );
    expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
            text: expect.stringContaining("https://community.example/verify-email?token=verification-token"),
        })
    );
});
