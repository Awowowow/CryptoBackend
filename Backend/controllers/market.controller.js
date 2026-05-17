import { getMarketOverview } from "../services/market-data-service/market.service.js";
import asyncWrapper from "../utils/asyncWrapper.js";

const getOverview = asyncWrapper(async (_req, res) => {
  const marketOverview = await getMarketOverview();

  res.status(200).json({
    success: true,
    message: "Market overview fetched successfully",
    data: marketOverview,
  });
});

export { getOverview };