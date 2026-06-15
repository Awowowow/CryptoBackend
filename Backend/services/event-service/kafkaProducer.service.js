import { Kafka } from "kafkajs";

const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || "cryptoex-backend";
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092")
  .split(",")
  .map((broker) => broker.trim())
  .filter(Boolean);

const WITHDRAWAL_EVENTS_TOPIC =
  process.env.KAFKA_WITHDRAWAL_EVENTS_TOPIC || "cryptoex.withdrawal.events";

const kafka = new Kafka({
  clientId: KAFKA_CLIENT_ID,
  brokers: KAFKA_BROKERS,
});

const producer = kafka.producer();

let isProducerConnected = false;

const connectKafkaProducer = async () => {
  if (isProducerConnected) {
    return;
  }

  await producer.connect();
  isProducerConnected = true;
};

const disconnectKafkaProducer = async () => {
  if (!isProducerConnected) {
    return;
  }

  await producer.disconnect();
  isProducerConnected = false;
};

const getTopicForDomainEvent = (event) => {
  if (event.aggregateType === "Withdrawal") {
    return WITHDRAWAL_EVENTS_TOPIC;
  }

  throw new Error(`Unsupported domain event aggregate type: ${event.aggregateType}`);
};

const publishDomainEventToKafka = async (event) => {
  await connectKafkaProducer();

  const topic = getTopicForDomainEvent(event);

  await producer.send({
    topic,
    messages: [
      {
        key: event.aggregateId,
        value: JSON.stringify({
          eventId: event.id,
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          payload: event.payload,
          createdAt: event.createdAt,
        }),
      },
    ],
  });
};

export {
  connectKafkaProducer,
  disconnectKafkaProducer,
  publishDomainEventToKafka,
};