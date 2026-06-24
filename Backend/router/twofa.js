import express from "express";
import authentication from "../middleware/authentication.js";
import {
  setup,
  verifySetup,
  verifyLogin,
  verifyRecent,
  deleteTrustedDevice,
  getTrustedDevices
} from "../controllers/twofa.controller.js";
import { twoFaVerifyRateLimiter } from "../middleware/rate-limiters/index.js";

const twofaRouter = express.Router();

twofaRouter.post("/verify-login" , twoFaVerifyRateLimiter ,verifyLogin);

twofaRouter.post("/setup",authentication, setup);

twofaRouter.post("/verify-setup",authentication, twoFaVerifyRateLimiter , verifySetup);

twofaRouter.post("/verify-recent", authentication, verifyRecent);

twofaRouter.get("/trusted-devices", authentication, getTrustedDevices);

twofaRouter.delete("/trusted-devices/:trustedDeviceId", authentication, deleteTrustedDevice);

export default twofaRouter;
