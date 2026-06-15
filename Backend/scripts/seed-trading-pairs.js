import "dotenv/config";
import prisma from "../config/prisma.js";

const seedTradingPairs = async () => {
  const eth = await prisma.asset.findUnique({
    where: {
      symbol: "ETH",
    },
  });

  const usdt = await prisma.asset.findUnique({
    where: {
      symbol: "USDT",
    },
  });

  if (!eth || !usdt) {
    throw new Error("ETH and USDT assets must exist before seeding trading pairs");
  }

  const tradingPair = await prisma.tradingPair.upsert({
    where: {
      symbol: "ETH-USDT",
    },
    update: {
      status: "ACTIVE",
      priceDecimals: 2,
      quantityDecimals: 8,
      minBaseQuantity: "0.00001",
      minQuoteAmount: "1",
    },
    create: {
      symbol: "ETH-USDT",
      baseAssetId: eth.id,
      quoteAssetId: usdt.id,
      status: "ACTIVE",
      priceDecimals: 2,
      quantityDecimals: 8,
      minBaseQuantity: "0.00001",
      minQuoteAmount: "1",
    },
  });

  console.log("Trading pair seeded:", tradingPair);
};

seedTradingPairs()
  .catch((error) => {
    console.error("Failed to seed trading pairs:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });