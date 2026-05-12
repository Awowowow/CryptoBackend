import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import hashToken from "../../utils/hashToken.js";
import generateRandomToken from "../../utils/tokenGenrator.js";

const TWO_FA_TEMP_MINUTES = 10;

const createTwoFaToken = async (userId) => {
  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);

  await prisma.authToken.deleteMany({
    where: {
      userId,
      type: "TWO_FA_TEMP",
    },
  });

  await prisma.authToken.create({
    data: {
      userId,
      type: "TWO_FA_TEMP",
      tokenHash,
      expiresAt: new Date(Date.now() + TWO_FA_TEMP_MINUTES * 60 * 1000),
    },
  });

  return rawToken;
};

const verifyTwoFaToken = async (rawToken) => {
  const tokenHash = hashToken(rawToken);

  const storedToken = await prisma.authToken.findFirst({
    where: {
      tokenHash,
      type: "TWO_FA_TEMP",
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: {
        include: {
          twoFaSecret: true,
        },
      },
    },
  });

  if (!storedToken) {
    throw new AppError("Invalid or expired 2FA token", 401);
  }

  return storedToken;
};

const markTwoFaTokenUsed = async (tokenId) => {
  await prisma.authToken.update({
    where: {
      id: tokenId,
    },
    data: {
      usedAt: new Date(),
    },
  });
};

export {
  createTwoFaToken,
  verifyTwoFaToken,
  markTwoFaTokenUsed,
};
