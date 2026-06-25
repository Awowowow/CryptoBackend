import prisma from "../config/prisma.js";

const assets = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    decimals: 8,
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
  },
  {
    symbol: "USDT",
    name: "Tether",
    decimals: 6,
  },
  {
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
  },
  {
    symbol: "BNB",
    name: "BNB",
    decimals: 18,
  },
  {
    symbol: "XRP",
    name: "XRP",
    decimals: 6,
  },
  {
    symbol: "ADA",
    name: "Cardano",
    decimals: 6,
  },
  {
    symbol: "DOGE",
    name: "Dogecoin",
    decimals: 8,
  },
  {
    symbol: "TRX",
    name: "TRON",
    decimals: 6,
  },
  {
    symbol: "LINK",
    name: "Chainlink",
    decimals: 18,
  },
  {
    symbol: "BCH",
    name: "Bitcoin Cash",
    decimals: 8,
  },
];

const seedAssets = async () => {
  for (const asset of assets) {
    await prisma.asset.upsert({
      where: {
        symbol: asset.symbol,
      },
      update: {
        name: asset.name,
        decimals: asset.decimals,
      },
      create: asset,
    });
  }
};

seedAssets()
  .then(async () => {
    console.log("Assets seeded successfully");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Failed to seed assets", error);
    await prisma.$disconnect();
    process.exit(1);
  });