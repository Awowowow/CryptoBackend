import { getOrderBook } from "../services/trading-service/orderBook.service.js";
import { getRecentTrades } from "../services/trading-service/recentTrade.service.js";
import { cancelTradeOrder, createTradeOrder, getUserTradeOrders } from "../services/trading-service/tradingOrder.service.js";
import { getTradingPairs } from "../services/trading-service/tradingPair.service.js";
import AppError from "../utils/AppError.js";
import asyncWrapper from "../utils/asyncWrapper.js";

const getTradingPairList = asyncWrapper(async (_req, res) => {
  const tradingPairs = await getTradingPairs();

  return res.status(200).json({
    success: true,
    message: "Trading pairs fetched successfully",
    data: tradingPairs,
  });
});

const createOrder = asyncWrapper(async (req, res) => {
    const userId = req.user.userId;
  
    if (!userId) {
      throw new AppError("Authenticated user is required", 401);
    }
  
    const {
      symbol,
      side,
      type,
      price,
      quantity,
      timeInForce,
      idempotencyKey: bodyIdempotencyKey,
    } = req.body;
  
    const headerIdempotencyKey = req.header("Idempotency-Key");
    const idempotencyKey = headerIdempotencyKey || bodyIdempotencyKey;
  
    const order = await createTradeOrder({
      userId,
      symbol,
      side,
      type,
      price,
      quantity,
      timeInForce,
      idempotencyKey,
    });
  
    return res.status(201).json({
      success: true,
      message: "Trade order created successfully",
      data: order,
    });
  });

const getMyOrders = asyncWrapper(async (req, res) => {
    const userId = req.user.userId;

    if (!userId) {
        throw new AppError("Authenticated user is required", 401);
    }

    const {status} = req.query;

    const orders = await getUserTradeOrders({
        userId,
        status,
    })

    return res.status(200).json({
        success: true,
        message: "Trade orders fetched successfully",
        data: orders,
    })
});

const cancelOrder = asyncWrapper(async(req, res) =>{
    const userId = req.user.userId;
    const {orderId} = req.params;

    const order = await cancelTradeOrder({
        userId,
        orderId,
    });

    return res.status(200).json({
        success: true,
        message: "Trade order cancelled successfully",
        data: order
    });
});

const getOrderBookController = asyncWrapper(async(req , res) =>{
    const {symbol} = req.query;

    const orderBook = await getOrderBook({
        symbol,
    });

    return res.status(200).json({
        success: true,
        message: "Order book fetched successfully",
        data: orderBook,
    });
});

const getRecentTradesController = asyncWrapper(async(req, res) =>{
    const {symbol, limit} = req.query;

    const recentTrades = await getRecentTrades({
        symbol,
        limit,
    });
    return res.status(200).json({
        success: true,
        message: "Recent trades fetched successfully",
        data: recentTrades,
    });
});


export { getTradingPairList, createOrder, getMyOrders, cancelOrder, getOrderBookController, getRecentTradesController };