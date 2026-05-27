import AppError from "../../utils/AppError.js";

const getRequiredEnv = (name) => {
  const value = process.env[name];

  if (!value) {
    throw new AppError(`${name} is not configured`, 500);
  }

  return value;
};


const createBitGoReceiveAddress = async ({ label }) => {
    const bitgoExpressUrl = process.env.BITGO_EXPRESS_URL || "http://localhost:3080";
    const accessToken = getRequiredEnv("BITGO_ACCESS_TOKEN");
    const coin = getRequiredEnv("BITGO_ETH_TEST_COIN");
    const walletId = getRequiredEnv("BITGO_ETH_WALLET_ID");
  
    const response = await fetch(
        `https://app.bitgo-test.com/api/v2/${coin}/wallet/${walletId}/address`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            label,
          }),
        }
      );

    const data = await response.json();


  if (!response.ok) {
    throw new AppError(
      data.error || data.message || "Failed to create BitGo receive address",
      response.status
    );
  }
  return {
    address: data.address,
    bitgoAddressId: data.id ?? null,
  };
}

export { createBitGoReceiveAddress };