import prisma from "../../config/prisma.js";
import AppError from "../../utils/appError.js";


const createAsset = async ({
  symbol,
  name,
  decimals,
}) => {
  const normalizedSymbol = symbol.trim().toUpperCase();

  const existingAsset = await prisma.asset.findUnique({
    where: {
      symbol: normalizedSymbol,
    },
  });

    if(existingAsset){
        throw new AppError(`Asset with symbol ${normalizedSymbol} already exists`, 409);
    }
    const asset = await prisma.asset.create({
        data:{
            symbol: normalizedSymbol,
            name: name.trim(),
            decimals,
        },
    });
    return asset
}

const getAssetBySymbol = async (symbol) => {
    const normalizedSymbol = symbol.trim().toUpperCase();
    const asset = await prisma.asset.findUnique({
        where:{
            symbol: normalizedSymbol,
        },
    });

    if(!asset){
        throw new AppError(`Asset with symbol ${normalizedSymbol} not found`, 404);
    }
    return asset
}    

export {
    createAsset,
    getAssetBySymbol,
  };