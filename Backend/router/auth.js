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

const authRouter = express.Router();

authRouter.post("/signup", signup);

authRouter.get("/verify-email", emailVerification);

authRouter.post("/forgot-password", forgotPassword);

authRouter.post("/reset-password", resetPassword);

authRouter.post("/login", login);

authRouter.post("/logout", logout);

authRouter.post("/refresh", refresh);

authRouter.use("/2fa", twofaRouter);

export default authRouter;
