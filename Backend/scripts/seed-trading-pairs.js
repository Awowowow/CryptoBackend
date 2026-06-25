import "dotenv/config";
import prisma from "../config/prisma.js";

const tradingPairs = [
  {
    symbol: "BTC-USDT",
    baseSymbol: "BTC",
    quoteSymbol: "USDT",
    priceDecimals: 2,
    quantityDecimals: 8,
    minBaseQuantity: "0.000001",
    minQuoteAmount: "1",
  },
  {
    symbol: "ETH-USDT",
    baseSymbol: "ETH",
    quoteSymbol: "USDT",
    priceDecimals: 2,
    quantityDecimals: 8,
    minBaseQuantity: "0.00001",
    minQuoteAmount: "1",
  },
  {
    symbol: "SOL-USDT",
    baseSymbol: "SOL",
    quoteSymbol: "USDT",
    priceDecimals: 2,
    quantityDecimals: 6,
    minBaseQuantity: "0.001",
    minQuoteAmount: "1",
  },
  {
    symbol: "BNB-USDT",
    baseSymbol: "BNB",
    quoteSymbol: "USDT",
    priceDecimals: 2,
    quantityDecimals: 6,
    minBaseQuantity: "0.001",
    minQuoteAmount: "1",
  },
  {
    symbol: "XRP-USDT",
    baseSymbol: "XRP",
    quoteSymbol: "USDT",
    priceDecimals: 4,
    quantityDecimals: 2,
    minBaseQuantity: "1",
    minQuoteAmount: "1",
  },
  {
    symbol: "ADA-USDT",
    baseSymbol: "ADA",
    quoteSymbol: "USDT",
    priceDecimals: 4,
    quantityDecimals: 2,
    minBaseQuantity: "1",
    minQuoteAmount: "1",
  },
  {
    symbol: "DOGE-USDT",
    baseSymbol: "DOGE",
    quoteSymbol: "USDT",
    priceDecimals: 5,
    quantityDecimals: 2,
    minBaseQuantity: "1",
    minQuoteAmount: "1",
  },
  {
    symbol: "TRX-USDT",
    baseSymbol: "TRX",
    quoteSymbol: "USDT",
    priceDecimals: 5,
    quantityDecimals: 2,
    minBaseQuantity: "1",
    minQuoteAmount: "1",
  },
  {
    symbol: "LINK-USDT",
    baseSymbol: "LINK",
    quoteSymbol: "USDT",
    priceDecimals: 3,
    quantityDecimals: 4,
    minBaseQuantity: "0.01",
    minQuoteAmount: "1",
  },
  {
    symbol: "BCH-USDT",
    baseSymbol: "BCH",
    quoteSymbol: "USDT",
    priceDecimals: 2,
    quantityDecimals: 6,
    minBaseQuantity: "0.001",
    minQuoteAmount: "1",
  },
];

const getAssetBySymbol = async (symbol) => {
  const asset = await prisma.asset.findUnique({
    where: {
      symbol,
    },
  });

  if (!asset) {
    throw new Error(`${symbol} asset must exist before seeding trading pairs`);
  }

  return asset;
};

const seedTradingPair = async (pair) => {
  const baseAsset = await getAssetBySymbol(pair.baseSymbol);
  const quoteAsset = await getAssetBySymbol(pair.quoteSymbol);

  const tradingPair = await prisma.tradingPair.upsert({
    where: {
      symbol: pair.symbol,
    },
    update: {
      baseAssetId: baseAsset.id,
      quoteAssetId: quoteAsset.id,
      status: "ACTIVE",
      priceDecimals: pair.priceDecimals,
      quantityDecimals: pair.quantityDecimals,
      minBaseQuantity: pair.minBaseQuantity,
      minQuoteAmount: pair.minQuoteAmount,
    },
    create: {
      symbol: pair.symbol,
      baseAssetId: baseAsset.id,
      quoteAssetId: quoteAsset.id,
      status: "ACTIVE",
      priceDecimals: pair.priceDecimals,
      quantityDecimals: pair.quantityDecimals,
      minBaseQuantity: pair.minBaseQuantity,
      minQuoteAmount: pair.minQuoteAmount,
    },
  });

  console.log("Trading pair seeded:", tradingPair.symbol);
};

const seedTradingPairs = async () => {
  for (const pair of tradingPairs) {
    await seedTradingPair(pair);
  }
};

seedTradingPairs()
  .catch((error) => {
    console.error("Failed to seed trading pairs:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });