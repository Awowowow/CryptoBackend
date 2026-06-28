import {
  FiatDepositProvider,
  FiatDepositStatus,
  LedgerTransactionType,
  WalletAccountType,
} from "@prisma/client";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import { toDecimal } from "../../utils/decimals.js";
import {
  getOrcreateSystemWalletAccount,
  getOrCreateUserWalletAccounts,
} from "../wallet-ledger-service/walletAccount.service.js";
import { postLedgerTransaction } from "../wallet-ledger-service/ledger.service.js";
import {
  createRazorpayOrder,
  verifyRazorpayCheckoutSignature,
} from "./razorpay.service.js";

const DEFAULT_FIAT_CURRENCY = process.env.RAZORPAY_CURRENCY || "INR";
const DEFAULT_USDT_RATE = process.env.RAZORPAY_USDT_RATE || "1";
const RAZORPAY_ORDER_EXPIRY_MINUTES = Number(
  process.env.RAZORPAY_ORDER_EXPIRY_MINUTES || 15
);

const getUsdtAsset = async () => {
  const asset = await prisma.asset.findUnique({
    where: {
      symbol: "USDT",
    },
  });

  if (!asset) {
    throw new AppError("USDT asset is not configured", 500);
  }

  return asset;
};

const calculateFiatDepositAmounts = ({ amount }) => {
  const fiatAmount = toDecimal(amount, "Fiat deposit amount");

  if (!fiatAmount.isPositive()) {
    throw new AppError("Deposit amount must be greater than zero", 400);
  }

  const fiatAmountMinor = fiatAmount.mul(100);

  if (!fiatAmountMinor.isInteger()) {
    throw new AppError("Deposit amount cannot have more than 2 decimals", 400);
  }

  const exchangeRate = toDecimal(DEFAULT_USDT_RATE, "USDT exchange rate");

  if (!exchangeRate.isPositive()) {
    throw new AppError("USDT exchange rate must be greater than zero", 500);
  }

  const creditedAmount = fiatAmount.mul(exchangeRate);

  return {
    fiatAmount,
    fiatAmountMinor: BigInt(fiatAmountMinor.toString()),
    exchangeRate,
    creditedAmount,
  };
};

const createFiatDepositOrder = async ({ userId, amount }) => {
  if (!userId) {
    throw new AppError("User id is required", 400);
  }

  const creditedAsset = await getUsdtAsset();

  const { fiatAmount, fiatAmountMinor, exchangeRate, creditedAmount } =
    calculateFiatDepositAmounts({ amount });

  const expiresAt = new Date(
    Date.now() + RAZORPAY_ORDER_EXPIRY_MINUTES * 60 * 1000
  );

  const order = await createRazorpayOrder({
    amountMinor: Number(fiatAmountMinor),
    currency: DEFAULT_FIAT_CURRENCY,
    receipt: `fd_${Date.now().toString(36)}`,
    notes: {
      userId,
      creditedAsset: creditedAsset.symbol,
      creditedAmount: creditedAmount.toString(),
    },
  });

  const fiatDeposit = await prisma.fiatDeposit.create({
    data: {
      userId,
      creditedAssetId: creditedAsset.id,
      provider: FiatDepositProvider.RAZORPAY,
      status: FiatDepositStatus.CREATED,
      providerOrderId: order.id,
      fiatCurrency: DEFAULT_FIAT_CURRENCY,
      fiatAmountMinor,
      fiatAmount,
      creditedAmount,
      exchangeRate,
      expiresAt,
      metadata: {
        razorpayOrder: order,
      },
    },
  });

  return {
    depositId: fiatDeposit.id,
    provider: fiatDeposit.provider,
    status: fiatDeposit.status,
    keyId: process.env.RAZORPAY_KEY_ID,
    orderId: order.id,
    currency: order.currency,
    amountMinor: order.amount,
    fiatAmount: fiatDeposit.fiatAmount.toString(),
    creditedAmount: fiatDeposit.creditedAmount.toString(),
    creditedAsset: {
      id: creditedAsset.id,
      symbol: creditedAsset.symbol,
      name: creditedAsset.name,
      decimals: creditedAsset.decimals,
    },
    expiresAt: fiatDeposit.expiresAt,
  };
};

const creditCapturedFiatDeposit = async ({ fiatDepositId }) => {
  const fiatDeposit = await prisma.fiatDeposit.findUnique({
    where: {
      id: fiatDepositId,
    },
    include: {
      creditedAsset: true,
    },
  });

  if (!fiatDeposit) {
    throw new AppError("Fiat deposit not found", 404);
  }

  if (fiatDeposit.status === FiatDepositStatus.CREDITED) {
    return fiatDeposit;
  }

  if (fiatDeposit.status !== FiatDepositStatus.PAYMENT_CAPTURED) {
    throw new AppError("Only captured fiat deposits can be credited", 409);
  }

  const userWalletAccounts = await getOrCreateUserWalletAccounts({
    userId: fiatDeposit.userId,
    assetId: fiatDeposit.creditedAssetId,
  });

  const userAvailableWalletAccount = userWalletAccounts.find(
    (walletAccount) => walletAccount.type === WalletAccountType.AVAILABLE
  );

  if (!userAvailableWalletAccount) {
    throw new AppError("User available wallet account is missing", 500);
  }

  const systemPaymentWalletAccount = await getOrcreateSystemWalletAccount({
    assetId: fiatDeposit.creditedAssetId,
    type: WalletAccountType.CUSTODY,
    label: "Razorpay fiat deposit clearing account",
  });

  await postLedgerTransaction({
    type: LedgerTransactionType.DEPOSIT,
    idempotencyKey: `fiat-deposit-credit:${fiatDeposit.id}`,
    referenceType: "FIAT_DEPOSIT",
    referenceId: fiatDeposit.id,
    description: `Credit fiat deposit ${fiatDeposit.id}`,
    entries: [
      {
        walletAccountId: systemPaymentWalletAccount.id,
        assetId: fiatDeposit.creditedAssetId,
        amount: fiatDeposit.creditedAmount.negated(),
      },
      {
        walletAccountId: userAvailableWalletAccount.id,
        assetId: fiatDeposit.creditedAssetId,
        amount: fiatDeposit.creditedAmount,
      },
    ],
  });

  return prisma.fiatDeposit.update({
    where: {
      id: fiatDeposit.id,
    },
    data: {
      status: FiatDepositStatus.CREDITED,
      creditedAt: new Date(),
    },
  });
};

const verifyAndCreditFiatDeposit = async ({
  userId,
  orderId,
  paymentId,
  signature,
}) => {
  if (!userId) {
    throw new AppError("User id is required", 400);
  }

  verifyRazorpayCheckoutSignature({
    orderId,
    paymentId,
    signature,
  });

  const fiatDeposit = await prisma.fiatDeposit.findUnique({
    where: {
      providerOrderId: orderId,
    },
  });

  if (!fiatDeposit) {
    throw new AppError("Fiat deposit order not found", 404);
  }

  if (fiatDeposit.userId !== userId) {
    throw new AppError("Fiat deposit does not belong to this user", 403);
  }

  if (fiatDeposit.status === FiatDepositStatus.CREDITED) {
    return fiatDeposit;
  }

  const capturedDeposit = await prisma.fiatDeposit.update({
    where: {
      id: fiatDeposit.id,
    },
    data: {
      status: FiatDepositStatus.PAYMENT_CAPTURED,
      providerPaymentId: paymentId,
      providerSignature: signature,
      paidAt: new Date(),
    },
  });

  return creditCapturedFiatDeposit({
    fiatDepositId: capturedDeposit.id,
  });
};

const formatFiatDeposit = (fiatDeposit) => {
  return {
    id: fiatDeposit.id,
    provider: fiatDeposit.provider,
    status: fiatDeposit.status,
    providerOrderId: fiatDeposit.providerOrderId,
    providerPaymentId: fiatDeposit.providerPaymentId,
    fiatCurrency: fiatDeposit.fiatCurrency,
    fiatAmount: fiatDeposit.fiatAmount.toString(),
    fiatAmountMinor: fiatDeposit.fiatAmountMinor.toString(),
    creditedAmount: fiatDeposit.creditedAmount.toString(),
    exchangeRate: fiatDeposit.exchangeRate.toString(),
    failureReason: fiatDeposit.failureReason,
    paidAt: fiatDeposit.paidAt,
    creditedAt: fiatDeposit.creditedAt,
    failedAt: fiatDeposit.failedAt,
    expiresAt: fiatDeposit.expiresAt,
    createdAt: fiatDeposit.createdAt,
    creditedAsset: fiatDeposit.creditedAsset
      ? {
          id: fiatDeposit.creditedAsset.id,
          symbol: fiatDeposit.creditedAsset.symbol,
          name: fiatDeposit.creditedAsset.name,
          decimals: fiatDeposit.creditedAsset.decimals,
        }
      : null,
  };
};

const listUserFiatDeposits = async ({ userId }) => {
  if (!userId) {
    throw new AppError("User id is required", 400);
  }

  const fiatDeposits = await prisma.fiatDeposit.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    include: {
      creditedAsset: true,
    },
  });

  return fiatDeposits.map(formatFiatDeposit);
};

export {
  createFiatDepositOrder,
  listUserFiatDeposits,
  verifyAndCreditFiatDeposit,
};
