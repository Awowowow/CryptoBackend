import { DomainEventOutboxStatus } from "@prisma/client";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";

const createDomainEventOutboxEntry = async ({
  eventType,
  aggregateType,
  aggregateId,
  idempotencyKey,
  payload,
}) => {
  if (!eventType || typeof eventType !== "string") {
    throw new AppError("Domain event type is required", 400);
  }

  if (!aggregateType || typeof aggregateType !== "string") {
    throw new AppError("Domain event aggregate type is required", 400);
  }

  if (!aggregateId || typeof aggregateId !== "string") {
    throw new AppError("Domain event aggregate id is required", 400);
  }

  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    throw new AppError("Domain event idempotency key is required", 400);
  }

  return prisma.domainEventOutbox.upsert({
    where: {
      idempotencyKey,
    },
    update: {},
    create: {
      eventType,
      aggregateType,
      aggregateId,
      idempotencyKey,
      payload,
      status: DomainEventOutboxStatus.PENDING,
    },
  });
};

export { createDomainEventOutboxEntry };