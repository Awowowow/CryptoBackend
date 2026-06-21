import "dotenv/config";
import { Kafka } from "kafkajs";
import { MARKET_EVENTS_TOPIC } from "../services/market-data-service/marketEvent.constants.js";
import {
  buildBinanceMarketStreamUrl,
  createMarketEventFromBinanceMessage,
} from "../services/market-data-service/binanceMarketProvider.service.js";

const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || "cryptoex-backend";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

const MARKET_DATA_SYMBOLS = (process.env.MARKET_DATA_SYMBOLS || "ETH-USDT")
  .split(",")
  .map((symbol) => symbol.trim())
  .filter(Boolean);

const MARKET_STREAM_RECONNECT_DELAY_MS = Number(
  process.env.MARKET_STREAM_RECONNECT_DELAY_MS || 5000
);

let socket = null;
let reconnectTimer = null;
let isShuttingDown = false;
let isProducerConnected = false;

const kafka = new Kafka({
  clientId: `${KAFKA_CLIENT_ID}-market-data-stream`,
  brokers: KAFKA_BROKERS,
});

const producer = kafka.producer();

const connectKafkaProducer = async () => {
  if (isProducerConnected) {
    return;
  }

  await producer.connect();
  isProducerConnected = true;
};

const publishMarketEventToKafka = async (marketEvent) => {
  await connectKafkaProducer();

  await producer.send({
    topic: MARKET_EVENTS_TOPIC,
    messages: [
      {
        key: marketEvent.symbol,
        value: JSON.stringify(marketEvent),
      },
    ],
  });
};

const parseWebSocketMessageData = async (messageData) => {
  if (typeof messageData === "string") {
    return JSON.parse(messageData);
  }

  if (messageData instanceof ArrayBuffer) {
    return JSON.parse(Buffer.from(messageData).toString("utf8"));
  }

  if (ArrayBuffer.isView(messageData)) {
    return JSON.parse(
      Buffer.from(
        messageData.buffer,
        messageData.byteOffset,
        messageData.byteLength
      ).toString("utf8")
    );
  }

  if (typeof messageData?.text === "function") {
    return JSON.parse(await messageData.text());
  }

  throw new Error("Unsupported WebSocket message data type");
};

const processBinanceMessage = async ({ messageData }) => {
  const binanceMessage = await parseWebSocketMessageData(messageData);

  const marketEvent = createMarketEventFromBinanceMessage(binanceMessage);

  await publishMarketEventToKafka(marketEvent);

  return marketEvent;
};

const scheduleReconnect = () => {
  if (isShuttingDown) {
    return;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  reconnectTimer = setTimeout(() => {
    startMarketDataStreamWorker().catch((error) => {
      console.error("Failed to reconnect market data stream:", error);
      scheduleReconnect();
    });
  }, MARKET_STREAM_RECONNECT_DELAY_MS);
};

const startMarketDataStreamWorker = async () => {
  if (typeof WebSocket === "undefined") {
    throw new Error("WebSocket is not available in this Node.js version");
  }

  await connectKafkaProducer();

  const streamUrl = buildBinanceMarketStreamUrl({
    symbols: MARKET_DATA_SYMBOLS,
  });

  socket = new WebSocket(streamUrl);

  socket.addEventListener("open", () => {
    console.log("Market data stream connected:", {
      symbols: MARKET_DATA_SYMBOLS,
      topic: MARKET_EVENTS_TOPIC,
    });
  });

  socket.addEventListener("message", async (event) => {
    try {
      const marketEvent = await processBinanceMessage({
        messageData: event.data,
      });

      console.log("Market event published:", {
        eventType: marketEvent.eventType,
        symbol: marketEvent.symbol,
        occurredAt: marketEvent.occurredAt,
      });
    } catch (error) {
      console.error("Failed to process Binance market message:", {
        error: error.message,
      });
    }
  });

  socket.addEventListener("close", (event) => {
    console.warn("Market data stream closed:", {
      code: event.code,
      reason: event.reason,
    });

    scheduleReconnect();
  });

  socket.addEventListener("error", (error) => {
    console.error("Market data stream error:", error);
  });
};

const shutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`Received ${signal}. Closing market data stream worker...`);

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  try {
    if (socket) {
      socket.close(1000, "Worker shutting down");
    }

    if (isProducerConnected) {
      await producer.disconnect();
      isProducerConnected = false;
    }

    console.log("Market data stream worker closed.");
    process.exit(0);
  } catch (error) {
    console.error("Failed to close market data stream worker:", error);
    process.exit(1);
  }
};

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection in market data stream worker:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in market data stream worker:", error);

  shutdown("uncaughtException");
});

await startMarketDataStreamWorker();