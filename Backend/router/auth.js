import express from "express";
import {
  emailVerification,
  forgotPassword,
  login,
  logout,
  refresh,
  resetPassword,
  signup,
} from "../controllers/auth.controller.js";
import twofaRouter from "./twofa.js";
import {
  emailVerifyRateLimiter,
  loginLongRateLimiter,
  loginShortRateLimiter,
  passwordResetRateLimiter,
  signupRateLimiter,
} from "../middleware/rate-limiters/index.js";

const authRouter = express.Router();

authRouter.post("/signup", signupRateLimiter, signup);

authRouter.get("/verify-email", emailVerifyRateLimiter, emailVerification);

authRouter.post("/forgot-password", passwordResetRateLimiter, forgotPassword);

authRouter.post("/reset-password", passwordResetRateLimiter , resetPassword);

authRouter.post("/login", loginShortRateLimiter, loginLongRateLimiter, login);

authRouter.post("/logout", logout);

authRouter.post("/refresh", refresh);

authRouter.use("/2fa", twofaRouter);

export default authRouter;
