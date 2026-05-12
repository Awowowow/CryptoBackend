import express from "express";
import authentication from "../middleware/authentication.js";
import {
  setup,
  verifySetup,
  verifyLogin,
  verifyRecent
} from "../controllers/twofa.controller.js";

const twofaRouter = express.Router();

twofaRouter.post("/verify-login" ,verifyLogin);

twofaRouter.post("/setup",authentication, setup);

twofaRouter.post("/verify-setup",authentication, verifySetup);

twofaRouter.post("/verify-recent", authentication, verifyRecent);

export default twofaRouter;
