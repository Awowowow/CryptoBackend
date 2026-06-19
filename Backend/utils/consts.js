import AppError from "./AppError.js";

export const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };



  const normalizeTradingPairSymbol = (symbol) => {
    if (!symbol || typeof symbol !== "string") {
      throw new AppError("Trading pair symbol is required", 400);
    }
  
    const normalizedSymbol = symbol.trim().toUpperCase();
  
    if (!normalizedSymbol) {
      throw new AppError("Trading pair symbol is required", 400);
    }
  
    return normalizedSymbol;
  };
  
  export { normalizeTradingPairSymbol };