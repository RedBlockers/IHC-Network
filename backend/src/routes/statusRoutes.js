"use strict";

const { Router } = require("express");

const maintenance = require("../infra/maintenance");
const config = require("../config");

const router = Router();

router.get("/", (_req, res) => {
    const state = maintenance.state();
    res.status(200).json({
        instance: { name: config.INSTANCE_NAME, url: config.PUBLIC_URL || config.CORS_ORIGIN[0] },
        maintenance: state?.active ? { active: true, reason: state.reason } : { active: false, reason: null },
    });
});

module.exports = router;
