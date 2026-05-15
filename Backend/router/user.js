import express from 'express';
import authentication from "../middleware/authentication.js";
import { getProfile } from '../controllers/user.controller.js';

const userRouter = express.Router();

userRouter.get("/profile", authentication, getProfile);

export default userRouter;