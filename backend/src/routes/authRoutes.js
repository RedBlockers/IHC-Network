"use strict";

const { Router } = require("express");

const authController = require("../controllers/authController");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const { uploadImage } = require("../middlewares/upload");
const { strictLimiter, authLimiter, refreshLimiter } = require("../middlewares/rateLimit");
const { asyncHandler } = require("../errors");
const trustedOrigin = require("../middlewares/trustedOrigin");
const {
    registerSchema, loginSchema, availabilitySchema, totpConfirmSchema, totpDisableSchema,
    credentialParam, securityKeyRegisterSchema, securityKeyLoginSchema, securityKeyRenameSchema,
    changePasswordSchema, sessionIdParam, loginHistorySchema,
    emailTokenSchema, requestResetSchema, resetPasswordSchema,
} = require("../validators/schemas");

const router = Router();

router.post(
    "/register",
    strictLimiter,
    uploadImage("avatar"),
    validate({ body: registerSchema }),
    asyncHandler(authController.register)
);

router.post("/login", authLimiter, validate({ body: loginSchema }), asyncHandler(authController.login));
router.post("/session", refreshLimiter, trustedOrigin, asyncHandler(authController.session));
router.post("/refresh", refreshLimiter, trustedOrigin, asyncHandler(authController.refresh));
router.post("/logout", refreshLimiter, trustedOrigin, asyncHandler(authController.logout));

router.get("/availability", strictLimiter, validate({ query: availabilitySchema }), asyncHandler(authController.checkAvailability));

router.get("/me", authenticate, asyncHandler(authController.me));

router.post("/verify/send", strictLimiter, authenticate, asyncHandler(authController.sendVerification));

router.get("/2fa", authenticate, asyncHandler(authController.twoFactorStatus));
router.post("/2fa/setup", strictLimiter, authenticate, asyncHandler(authController.beginTwoFactor));
router.post("/2fa/confirm", strictLimiter, authenticate, validate({ body: totpConfirmSchema }), asyncHandler(authController.confirmTwoFactor));
router.post("/2fa/recovery", strictLimiter, authenticate, asyncHandler(authController.regenerateRecoveryCodes));
router.delete("/2fa", strictLimiter, authenticate, validate({ body: totpDisableSchema }), asyncHandler(authController.disableTwoFactor));

router.get("/security-keys", authenticate, asyncHandler(authController.securityKeys));
router.post("/security-keys/options", strictLimiter, authenticate, asyncHandler(authController.beginSecurityKey));
router.post(
    "/security-keys",
    strictLimiter,
    authenticate,
    validate({ body: securityKeyRegisterSchema }),
    asyncHandler(authController.finishSecurityKey)
);
router.patch(
    "/security-keys/:credentialId",
    authenticate,
    validate({ params: credentialParam, body: securityKeyRenameSchema }),
    asyncHandler(authController.renameSecurityKey)
);
router.delete(
    "/security-keys/:credentialId",
    strictLimiter,
    authenticate,
    validate({ params: credentialParam }),
    asyncHandler(authController.removeSecurityKey)
);

router.post("/security-keys/login/options", strictLimiter, asyncHandler(authController.beginSecurityKeyLogin));
router.post(
    "/security-keys/login",
    strictLimiter,
    validate({ body: securityKeyLoginSchema }),
    asyncHandler(authController.finishSecurityKeyLogin)
);

router.post(
    "/verify",
    strictLimiter,
    validate({ body: emailTokenSchema }),
    asyncHandler(authController.verifyEmail)
);

router.post(
    "/password/forgot",
    strictLimiter,
    validate({ body: requestResetSchema }),
    asyncHandler(authController.requestPasswordReset)
);

router.post(
    "/password/reset",
    strictLimiter,
    validate({ body: resetPasswordSchema }),
    asyncHandler(authController.resetPassword)
);

router.post(
    "/password",
    strictLimiter,
    trustedOrigin,
    authenticate,
    validate({ body: changePasswordSchema }),
    asyncHandler(authController.changePassword)
);

router.get("/devices", authenticate, asyncHandler(authController.listDevices));

router.delete(
    "/devices/:sessionId",
    trustedOrigin,
    authenticate,
    validate({ params: sessionIdParam }),
    asyncHandler(authController.revokeDevice)
);

router.delete("/devices", trustedOrigin, authenticate, asyncHandler(authController.revokeOtherDevices));

router.get(
    "/history",
    authenticate,
    validate({ query: loginHistorySchema }),
    asyncHandler(authController.loginHistory)
);

module.exports = router;
