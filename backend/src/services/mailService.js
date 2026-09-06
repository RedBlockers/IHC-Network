"use strict";

const nodemailer = require("nodemailer");

const config = require("../config");
const { logger, serializeError } = require("../logger");

let transport = null;

function smtpConfigured() {
    return Boolean(config.SMTP_HOST && config.SMTP_PORT);
}

function getTransport() {
    if (transport) return transport;
    if (!smtpConfigured()) return null;

    transport = nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: Number(config.SMTP_PORT),
        secure: Number(config.SMTP_PORT) === 465,
        disableFileAccess: true,
        disableUrlAccess: true,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
    });
    return transport;
}

async function send({ to, subject, text }) {
    const from = config.MAIL_FROM || "qweillo <no-reply@localhost>";
    const mailer = getTransport();

    if (!mailer) {
        logger.warn("courrier non envoyé : aucun SMTP configuré");
        return { delivered: false, reason: "smtp-not-configured" };
    }

    try {
        await mailer.sendMail({ from, to, subject, text });
        return { delivered: true };
    } catch (error) {
        logger.error("échec d'envoi de courrier", { error: serializeError(error) });
        return { delivered: false, reason: "send-failed" };
    }
}

const link = (path) => `${(config.PUBLIC_URL || config.CORS_ORIGIN[0]).replace(/\/+$/, "")}${path}`;

async function sendVerification(user, token) {
    return send({
        to: user.email,
        subject: "Confirmez votre adresse",
        text: [
            `Bonjour ${user.displayName || user.handle},`,
            "",
            "Confirmez votre adresse pour finir d'ouvrir votre compte :",
            link(`/verify-email?token=${token}`),
            "",
            "Ce lien est valable 24 heures et ne sert qu'une fois.",
            "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
        ].join("\n"),
    });
}

async function sendPasswordReset(user, token) {
    return send({
        to: user.email,
        subject: "Réinitialiser votre mot de passe",
        text: [
            `Bonjour ${user.displayName || user.handle},`,
            "",
            "Vous pouvez choisir un nouveau mot de passe ici :",
            link(`/reset-password?token=${token}`),
            "",
            "Ce lien est valable 1 heure et ne sert qu'une fois.",
            "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message :",
            "votre mot de passe actuel reste valable.",
        ].join("\n"),
    });
}

async function sendNewDeviceAlert(user, { deviceLabel, at }) {
    return send({
        to: user.email,
        subject: "Nouvelle connexion à votre compte",
        text: [
            `Bonjour ${user.displayName || user.handle},`,
            "",
            `Votre compte vient d'être utilisé depuis un appareil inhabituel : ${deviceLabel}.`,
            `Date : ${at.toLocaleString("fr-FR")}.`,
            "",
            "Si c'était vous, il n'y a rien à faire.",
            "Sinon, changez votre mot de passe et fermez les autres sessions depuis",
            "les réglages de sécurité de votre compte.",
            "",
            "Nous ne mettons volontairement aucun lien dans ce message :",
            "ouvrez l'application vous-même.",
        ].join("\n"),
    });
}

async function sendDeletionScheduled(user, { deadline }) {
    return send({
        to: user.email,
        subject: "Suppression de votre compte programmée",
        text: [
            `Bonjour ${user.displayName || user.handle},`,
            "",
            `La suppression de votre compte a été demandée. Elle prendra effet le ${deadline.toLocaleDateString("fr-FR")}.`,
            "",
            "Si vous changez d'avis, reconnectez-vous avant cette date : la demande sera annulée.",
            "Si ce n'est pas vous qui l'avez demandée, reconnectez-vous immédiatement et",
            "changez votre mot de passe. Toutes vos sessions ont été fermées.",
            "",
            "Nous ne mettons volontairement aucun lien dans ce message :",
            "ouvrez l'application vous-même.",
        ].join("\n"),
    });
}

module.exports = {
    send,
    sendVerification,
    sendPasswordReset,
    sendNewDeviceAlert,
    sendDeletionScheduled,
    smtpConfigured,
};
