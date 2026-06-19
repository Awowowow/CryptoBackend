import express from "express";
import { cancelOrder, createOrder, getMyOrders, getTradingPairList } from "../controllers/trading.controller.js";
import authentication from "../middleware/authentication.js";

const tradingRouter = express.Router();

tradingRouter.get("/pairs", getTradingPairList);

tradingRouter.get("/orders", authentication, getMyOrders);

tradingRouter.post("/orders",authentication, createOrder);

tradingRouter.post("/orders/:orderId/cancel", authentication, cancelOrder);



export default tradingRouter