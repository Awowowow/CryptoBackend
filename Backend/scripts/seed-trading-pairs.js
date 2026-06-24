import "dotenv/config";
import prisma from "../config/prisma.js";

const tradingPairs = [
  {
    symbol: "ETH-USDT",
    baseAssetSymbol: "ETH",
    quoteAssetSymbol: "USDT",
    priceDecimals: 2,
    quantityDecimals: 8,
    minBaseQuantity: "0.00001",
    minQuoteAmount: "1",
  },
  {
    symbol: "BTC-USDT",
    baseAssetSymbol: "BTC",
    quoteAssetSymbol: "USDT",
    priceDecimals: 2,
    quantityDecimals: 8,
    minBaseQuantity: "0.000001",
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
  const baseAsset = await getAssetBySymbol(pair.baseAssetSymbol);
  const quoteAsset = await getAssetBySymbol(pair.quoteAssetSymbol);

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