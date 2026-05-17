import redisClient from "../../config/redis.js";
import AppError from "../../utils/appError.js";

const MARKET_OVERVIEW_CACHE_KEY = "market:overview";
const MARKET_OVERVIEW_CACHE_TTL_SECONDS = 15;

const BINANCE_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "TRXUSDT",
  "LINKUSDT",
  "BCHUSDT",
];

const COINGECKO_IDS = [
  "bitcoin",
  "ethereum",
  "binancecoin",
  "solana",
  "ripple",
  "dogecoin",
  "cardano",
  "tron",
  "chainlink",
  "bitcoin-cash",
];

const BINANCE_MARKET_URL =
  "https://data-api.binance.vision/api/v3/ticker/24hr";

const COINGECKO_MARKET_URL =
  "https://api.coingecko.com/api/v3/coins/markets";

const fetchBinanceTickers = async () => {
  const symbolsQuery = encodeURIComponent(JSON.stringify(BINANCE_SYMBOLS));

  let response;

  try {
    response = await fetch(
      `${BINANCE_MARKET_URL}?symbols=${symbolsQuery}`
    );
  } catch {
    throw new AppError("Failed to fetch Binance market data", 502);
  }

  if (!response.ok) {
    throw new AppError("Binance market data is unavailable", 502);
  }

  return response.json();
};

const fetchCoinGeckoMarkets = async () => {
  const idsQuery = COINGECKO_IDS.join(",");

  let response;

  try {
    response = await fetch(
      `${COINGECKO_MARKET_URL}?vs_currency=usd&ids=${idsQuery}&order=market_cap_desc&sparkline=false`
    );
  } catch {
    throw new AppError("Failed to fetch CoinGecko market data", 502);
  }

  if (!response.ok) {
    throw new AppError("CoinGecko market data is unavailable", 502);
  }

  return response.json();
};

const buildCoinGeckoDataBySymbol = (coinGeckoMarkets) => {
  return new Map(
    coinGeckoMarkets.map((asset) => [
      asset.symbol.toUpperCase(),
      {
        id: asset.id,
        name: asset.name,
        image: asset.image,
        marketCapUsd: asset.market_cap,
        marketCapRank: asset.market_cap_rank,
      },
    ])
  );
};

const normalizeCombinedAsset = ({
  binanceTicker,
  coinGeckoMetadata,
}) => {
  const symbol = binanceTicker.symbol.replace("USDT", "");

  return {
    id: coinGeckoMetadata.id,
    symbol,
    name: coinGeckoMetadata.name,
    image: coinGeckoMetadata.image,
    priceUsd: Number(binanceTicker.lastPrice),
    marketCapUsd: coinGeckoMetadata.marketCapUsd,
    marketCapRank: coinGeckoMetadata.marketCapRank,
    volume24hUsd: Number(binanceTicker.quoteVolume),
    high24hUsd: Number(binanceTicker.highPrice),
    low24hUsd: Number(binanceTicker.lowPrice),
    change24hPercent: Number(binanceTicker.priceChangePercent),
    lastUpdatedAt: new Date().toISOString(),
  };
};

const getMarketOverview = async () => {
  const cachedMarketOverview = await redisClient.get(
    MARKET_OVERVIEW_CACHE_KEY
  );

  if (cachedMarketOverview) {
    return JSON.parse(cachedMarketOverview);
  }

  const [binanceTickers, coinGeckoMarkets] = await Promise.all([
    fetchBinanceTickers(),
    fetchCoinGeckoMarkets(),
  ]);

  const coinGeckoDataBySymbol =
    buildCoinGeckoDataBySymbol(coinGeckoMarkets);

  const marketOverview = binanceTickers
    .map((binanceTicker) => {
      const symbol = binanceTicker.symbol.replace("USDT", "");
      const coinGeckoMetadata = coinGeckoDataBySymbol.get(symbol);

      if (!coinGeckoMetadata) {
        return null;
      }

      return normalizeCombinedAsset({
        binanceTicker,
        coinGeckoMetadata,
      });
    })
    .filter(Boolean)
    .sort((firstAsset, secondAsset) => {
      return firstAsset.marketCapRank - secondAsset.marketCapRank;
    });

  await redisClient.setEx(
    MARKET_OVERVIEW_CACHE_KEY,
    MARKET_OVERVIEW_CACHE_TTL_SECONDS,
    JSON.stringify(marketOverview)
  );

  return marketOverview;
};

export { getMarketOverview };