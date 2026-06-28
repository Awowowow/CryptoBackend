import express from "express";
import {
  createRazorpayDepositOrder,
  getMyFiatDeposits,
  verifyRazorpayDepositPayment,
} from "../controllers/payment.controller.js";
import authentication from "../middleware/authentication.js";

const paymentRouter = express.Router();

paymentRouter.post("/razorpay/orders",authentication,createRazorpayDepositOrder);

paymentRouter.post("/razorpay/verify",authentication,verifyRazorpayDepositPayment);

paymentRouter.get("/deposits",authentication,getMyFiatDeposits);

export default paymentRouter;