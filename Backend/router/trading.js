import express from "express";
import { cancelOrder, createOrder, getMarketSummaryController, getMyOrders, getMyTrades, getOrderBookController, getRecentTradesController, getTradingPairList } from "../controllers/trading.controller.js";
import authentication from "../middleware/authentication.js";

const tradingRouter = express.Router();

tradingRouter.get("/pairs", getTradingPairList);

tradingRouter.get("/orders", authentication, getMyOrders);

tradingRouter.get("/order-book", getOrderBookController);

tradingRouter.get("/recent-trades", getRecentTradesController);

tradingRouter.get("/my-trades", authentication, getMyTrades);

tradingRouter.get("/market-summary", getMarketSummaryController);

tradingRouter.post("/orders",authentication, createOrder);

tradingRouter.post("/orders/:orderId/cancel", authentication, cancelOrder);

export default tradingRouter 