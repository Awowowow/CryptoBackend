import { getEvmProvider } from "./evmProvider.service.js";

const getEvmHealth = async () => {
  const provider = getEvmProvider();

  const network = await provider.getNetwork();
  const latestBlockNumber = await provider.getBlockNumber();

  return {
    chainId: Number(network.chainId),
    name: network.name,
    latestBlockNumber,
  };
};

export { getEvmHealth };