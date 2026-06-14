import AppError from "../../utils/AppError.js";
import { createBitGoReceiveAddress, getBitGoTransfer, sendBitGoWithdrawal } from "../blockchain-service/bitgoWalletProvider.service.js";

const CustodyProvider = Object.freeze({
  BITGO: "BITGO",
});

const getCustodyTransfer = async ({
  provider = CustodyProvider.BITGO,
  networkCode,
  transferId,
}) => {
  if (!networkCode || typeof networkCode !== "string") {
    throw new AppError("Custody network code is required", 400);
  }

  if (!transferId || typeof transferId !== "string") {
    throw new AppError("Custody transfer id is required", 400);
  }

  if (provider === CustodyProvider.BITGO) {
    return getBitGoTransfer({
      networkCode,
      transferId,
    });
  }

  throw new AppError("Unsupported custody provider", 400);
};

const sendCustodyWithdrawal = async ({
  provider = CustodyProvider.BITGO,
  networkCode,
  address,
  amountBaseUnits,
  comment = null,
}) => {
  if (!networkCode || typeof networkCode !== "string") {
    throw new AppError("Custody network code is required", 400);
  }

  if (provider === CustodyProvider.BITGO) {
    return sendBitGoWithdrawal({
      networkCode,
      address,
      amountBaseUnits,
      comment,
    });
  }

  throw new AppError("Unsupported custody provider", 400);
};

const createCustodyReceiveAddress = async ({
  provider = CustodyProvider.BITGO,
  networkCode,
  label,
}) => {
  if (!networkCode || typeof networkCode !== "string") {
    throw new AppError("Custody network code is required", 400);
  }

  if (provider === CustodyProvider.BITGO) {
    return createBitGoReceiveAddress({
      networkCode,
      label,
    });
  }

  throw new AppError("Unsupported custody provider", 400);
};

export {
  createCustodyReceiveAddress,
  CustodyProvider,
  getCustodyTransfer,
  sendCustodyWithdrawal,
};