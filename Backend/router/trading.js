import express from "express";
import { cancelOrder, createOrder, getMarketCandlesController, getMarketSummaryController, getMyOrders, getMyTrades, getOrderBookController, getRecentTradesController, getTradingPairList } from "../controllers/trading.controller.js";
import authentication from "../middleware/authentication.js";
import { tradeOrderCreateRateLimiter, tradingReadRateLimiter } from "../middleware/rate-limiters/index.js";

const tradingRouter = express.Router();

tradingRouter.get("/pairs",tradingReadRateLimiter , getTradingPairList);

tradingRouter.get("/orders", authentication, getMyOrders);

tradingRouter.get("/order-book",tradingReadRateLimiter, getOrderBookController);

tradingRouter.get("/recent-trades", tradingReadRateLimiter, getRecentTradesController);

tradingRouter.get("/my-trades", authentication, getMyTrades);

tradingRouter.get("/market-summary", tradingReadRateLimiter, getMarketSummaryController);

tradingRouter.get("/candles", tradingReadRateLimiter, getMarketCandlesController);

tradingRouter.post("/orders",authentication, tradeOrderCreateRateLimiter , createOrder);

tradingRouter.post("/orders/:orderId/cancel", authentication, cancelOrder);

export default tradingRouter 