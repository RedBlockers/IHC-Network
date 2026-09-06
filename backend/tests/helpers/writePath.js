"use strict";

const { on } = require("./db");

function allowWrite() {
    on("moderation.findActiveSanction", () => null);
    on("onboarding.findConfig", () => null);
    on("automod.findConfig", () => null);
}

module.exports = { allowWrite };
