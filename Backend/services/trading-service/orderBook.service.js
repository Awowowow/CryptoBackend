import {
    TradeOrderSide,
    TradeOrderStatus,
  } from "@prisma/client";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import { toDecimal } from "../../utils/decimals.js";
import { normalizeTradingPairSymbol } from "../../utils/consts.js";
  
const ORDER_BOOK_ORDER_STATUSES = [
    TradeOrderStatus.OPEN,
    TradeOrderStatus.PARTIALLY_FILLED,
];

const buildOrderBookLevels = ({ orders, sortDirection }) => {
    const levelsByPrice = new Map();
  
    for (const order of orders) {
      const price = toDecimal(order.price, "Order price");
      const remainingQuantity = toDecimal(
        order.remainingQuantity,
        "Order remaining quantity"
      );
  
      const priceKey = price.toString();
      const existingLevel = levelsByPrice.get(priceKey);
  
      if (existingLevel) {
        existingLevel.quantity = existingLevel.quantity.plus(remainingQuantity);
        existingLevel.orderCount += 1;
      } else {
        levelsByPrice.set(priceKey, {
          price,
          quantity: remainingQuantity,
          orderCount: 1,
        });
      }
    }
  
    const levels = Array.from(levelsByPrice.values());
  
    levels.sort((a, b) => {
      if (sortDirection === "asc") {
        return a.price.comparedTo(b.price);
      }
  
      return b.price.comparedTo(a.price);
    });
  
    return levels.map((level) => {
      const total = level.price.times(level.quantity);
  
      return {
        price: level.price.toString(),
        quantity: level.quantity.toString(),
        total: total.toString(),
        orderCount: level.orderCount,
      };
    });
  };

const getOrderBook = async ({ symbol }) => {
    const normalizedSymbol = normalizeTradingPairSymbol(symbol);
  
    const tradingPair = await prisma.tradingPair.findUnique({
      where: {
        symbol: normalizedSymbol,
      },
      include: {
        baseAsset: true,
        quoteAsset: true,
      },
    });
  
    if (!tradingPair || tradingPair.status !== "ACTIVE") {
      throw new AppError("Trading pair is not available", 404);
    }
  
    const [buyOrders, sellOrders] = await Promise.all([
      prisma.tradeOrder.findMany({
        where: {
          tradingPairId: tradingPair.id,
          side: TradeOrderSide.BUY,
          status: {
            in: ORDER_BOOK_ORDER_STATUSES,
          },
          remainingQuantity: {
            gt: 0,
          },
        },
        select: {
          price: true,
          remainingQuantity: true,
        },
      }),
  
      prisma.tradeOrder.findMany({
        where: {
          tradingPairId: tradingPair.id,
          side: TradeOrderSide.SELL,
          status: {
            in: ORDER_BOOK_ORDER_STATUSES,
          },
          remainingQuantity: {
            gt: 0,
          },
        },
        select: {
          price: true,
          remainingQuantity: true,
        },
      }),
    ]);
  
    const bids = buildOrderBookLevels({
      orders: buyOrders,
      sortDirection: "desc",
    });
  
    const asks = buildOrderBookLevels({
      orders: sellOrders,
      sortDirection: "asc",
    });
  
    const bestBid = bids[0] ? toDecimal(bids[0].price, "Best bid") : null;
    const bestAsk = asks[0] ? toDecimal(asks[0].price, "Best ask") : null;
  
    const spread =
      bestBid && bestAsk ? bestAsk.minus(bestBid).toString() : null;
  
    return {
      symbol: tradingPair.symbol,
      baseAsset: {
        id: tradingPair.baseAsset.id,
        symbol: tradingPair.baseAsset.symbol,
        name: tradingPair.baseAsset.name,
        decimals: tradingPair.baseAsset.decimals,
      },
      quoteAsset: {
        id: tradingPair.quoteAsset.id,
        symbol: tradingPair.quoteAsset.symbol,
        name: tradingPair.quoteAsset.name,
        decimals: tradingPair.quoteAsset.decimals,
      },
      bids,
      asks,
      spread,
    };
  };
  
  export { getOrderBook };