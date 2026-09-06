"use strict";

const { Router } = require("express");

const e2eeController = require("../controllers/e2eeController");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const { asyncHandler } = require("../errors");
const { registerDeviceSchema, deviceIdParam } = require("../validators/schemas");

const router = Router();

router.use(authenticate);

router.post("/devices", validate({ body: registerDeviceSchema }), asyncHandler(e2eeController.registerDevice));
router.get("/devices", asyncHandler(e2eeController.listDevices));
router.delete("/devices/:deviceId", validate({ params: deviceIdParam }), asyncHandler(e2eeController.revokeDevice));

module.exports = router;
