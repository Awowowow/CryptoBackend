import { getEvmHealth } from "../services/blockchain-service/evmHealth.service.js";
import { scanNativeEthDeposits } from "../services/blockchain-service/evmNativeDepositScanner.service.js";
import asyncWrapper from "../utils/asyncWrapper.js";


const getBlockChainHealth = asyncWrapper(async(req,res) =>{
    const health = await getEvmHealth();

    res.status(200).json({
      success: true,
      message: "Blockchain connection healthy",
      data: health,
    });
});


const scanNativeEthDepositRange = asyncWrapper(async (req, res) => {
    const { fromBlock, toBlock } = req.body ?? {};
  
    if (!Number.isInteger(fromBlock) || !Number.isInteger(toBlock)) {
      return res.status(400).json({
        success: false,
        error: "fromBlock and toBlock must be integers",
      });
    }
  
    if (fromBlock > toBlock) {
      return res.status(400).json({
        success: false,
        error: "fromBlock cannot be greater than toBlock",
      });
    }
  
    const result = await scanNativeEthDeposits({
      fromBlock,
      toBlock,
    });
  
    res.status(200).json({
      success: true,
      message: "Native ETH deposit scan completed",
      data: result,
    });
  });

  export { getBlockChainHealth, scanNativeEthDepositRange };