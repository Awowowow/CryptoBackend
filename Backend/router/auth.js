import express from "express";
import {
  emailVerification,
  login,
  logout,
  refresh,
  signup,
} from "../controllers/auth.controller.js";
import twofaRouter from "./twofa.js";

const authRouter = express.Router();

authRouter.post("/signup", signup);

authRouter.get("/verify-email", emailVerification);

authRouter.post("/login", login);

authRouter.post("/logout", logout);

authRouter.post("/refresh", refresh);

authRouter.use("/2fa", twofaRouter);

export default authRouter;
