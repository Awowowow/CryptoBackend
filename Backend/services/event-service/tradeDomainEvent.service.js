import AppError from "../../utils/AppError.js";
import { createDomainEventOutboxEntry } from "./domainEventOutbox.service.js";

const TradeDomainEventType = Object.freeze({
  EXECUTED: "trade.executed",
});

const createTradeExecutedDomainEvent = async ({ trade, tx }) => {
  if (!trade || !trade.id) {
    throw new AppError("Trade is required for trade executed event", 500);
  }

  return createDomainEventOutboxEntry({
    eventType: TradeDomainEventType.EXECUTED,
    aggregateType: "Trade",
    aggregateId: trade.id,
    idempotencyKey: `${TradeDomainEventType.EXECUTED}:${trade.id}`,
    payload: {
      tradeId: trade.id,
      tradingPairId: trade.tradingPairId,
      baseAssetId: trade.baseAssetId,
      quoteAssetId: trade.quoteAssetId,
      makerOrderId: trade.makerOrderId,
      takerOrderId: trade.takerOrderId,
      buyerUserId: trade.buyerUserId,
      sellerUserId: trade.sellerUserId,
      price: trade.price.toString(),
      quantity: trade.quantity.toString(),
      quoteAmount: trade.quoteAmount.toString(),
      buyerFeeAssetId: trade.buyerFeeAssetId,
      buyerFeeAmount: trade.buyerFeeAmount.toString(),
      sellerFeeAssetId: trade.sellerFeeAssetId,
      sellerFeeAmount: trade.sellerFeeAmount.toString(),
      makerSide: trade.makerSide,
      takerSide: trade.takerSide,
      createdAt: trade.createdAt.toISOString(),
    },
    tx,
  });
};

export {
  TradeDomainEventType,
  createTradeExecutedDomainEvent,
};