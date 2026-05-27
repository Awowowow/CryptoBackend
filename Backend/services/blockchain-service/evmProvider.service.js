import { ethers } from "ethers";
import AppError from "../../utils/AppError.js";

const getEvmProvider = () =>{
    const rpcUrl = process.env.EVM_RPC_URL;

    if(!rpcUrl){
        throw new AppError("EVM RPC URL is not configured", 500);
    }

    return new ethers.JsonRpcProvider(rpcUrl);
}

export { getEvmProvider };