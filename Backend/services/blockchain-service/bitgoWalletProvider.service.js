import AppError from "../../utils/AppError.js";

const getRequiredEnv = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new AppError(`${name} is not configured`, 500);
  }

  return value;
};

const getBitGoWalletConfig = (networkCode) => {
  if (networkCode !== "ETH_HOODI") {
    throw new AppError(
      "BitGo is not configured for this network",
      400
    );
  }

  return {
    coin: getRequiredEnv("BITGO_ETH_TEST_COIN"),
    walletId: getRequiredEnv("BITGO_ETH_WALLET_ID"),
  };
};

const requestBitGo = async ({ url, method = "GET", body = null }) => {
  const accessToken = getRequiredEnv("BITGO_ACCESS_TOKEN");

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new AppError(
      data.error || data.message || "BitGo request failed",
      response.status
    );
  }

  return data;
};

const createBitGoReceiveAddress = async ({ networkCode, label }) => {
  const { coin, walletId } = getBitGoWalletConfig(networkCode);

  const data = await requestBitGo({
    url: `https://app.bitgo-test.com/api/v2/${coin}/wallet/${walletId}/address`,
    method: "POST",
    body: {
      label,
    },
  });

  return {
    address: data.address,
    bitgoAddressId: data.id ?? null,
  };
};

const getBitGoTransfer = async ({ networkCode, transferId }) => {
  if (!transferId || typeof transferId !== "string") {
    throw new AppError("BitGo transfer id is required", 400);
  }

  const { coin, walletId } = getBitGoWalletConfig(networkCode);

  return requestBitGo({
    url: `https://app.bitgo-test.com/api/v2/${coin}/wallet/${walletId}/transfer/${transferId}`,
  });
};

const sendBitGoWithdrawal = async ({
  networkCode,
  address,
  amountBaseUnits,
  comment = null,
}) => {
  if (!address || typeof address !== "string") {
    throw new AppError("BitGo withdrawal address is required", 400);
  }

  if (
    !amountBaseUnits ||
    typeof amountBaseUnits !== "string" ||
    !/^\d+$/.test(amountBaseUnits)
  ) {
    throw new AppError("BitGo withdrawal amount is invalid", 400);
  }

  const normalizedAddress = address.trim();

  if (!normalizedAddress) {
    throw new AppError("BitGo withdrawal address is required", 400);
  }

  const { coin, walletId } = getBitGoWalletConfig(networkCode);

  const body = {
    address: normalizedAddress,
    amount: amountBaseUnits,
    type: "transfer",
    walletPassphrase: getRequiredEnv("BITGO_WALLET_PASSPHRASE"),
  };

  if (comment) {
    body.comment = comment;
  }

  return requestBitGo({
    url: `${process.env.BITGO_EXPRESS_URL || "http://localhost:3080"}/api/v2/${coin}/wallet/${walletId}/sendcoins`,
    method: "POST",
    body,
  });
};


export {
  createBitGoReceiveAddress,
  getBitGoTransfer,
  sendBitGoWithdrawal,
};