import asyncWrapper from "../utils/asyncWrapper.js";
import {
  createFiatDepositOrder,
  listUserFiatDeposits,
  verifyAndCreditFiatDeposit,
} from "../services/payment-service/paymentDeposit.service.js";

const createRazorpayDepositOrder = asyncWrapper(async (req, res) => {
  const userId = req.user.userId;
  const { amount } = req.body ?? {};

  const result = await createFiatDepositOrder({
    userId,
    amount,
  });

  return res.status(201).json({
    success: true,
    message: "Razorpay deposit order created successfully",
    data: result,
  });
});

const verifyRazorpayDepositPayment = asyncWrapper(async (req, res) => {
  const userId = req.user.userId;

  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
  } = req.body ?? {};

  const result = await verifyAndCreditFiatDeposit({
    userId,
    orderId,
    paymentId,
    signature,
  });

  return res.status(200).json({
    success: true,
    message: "Razorpay deposit verified and credited successfully",
    data: {
      id: result.id,
      status: result.status,
      providerOrderId: result.providerOrderId,
      providerPaymentId: result.providerPaymentId,
      fiatAmount: result.fiatAmount.toString(),
      creditedAmount: result.creditedAmount.toString(),
      paidAt: result.paidAt,
      creditedAt: result.creditedAt,
    },
  });
});

const getMyFiatDeposits = asyncWrapper(async (req, res) => {
  const userId = req.user.userId;

  const deposits = await listUserFiatDeposits({
    userId,
  });

  return res.status(200).json({
    success: true,
    message: "Fiat deposits fetched successfully",
    data: deposits,
  });
});

export {
  createRazorpayDepositOrder,
  getMyFiatDeposits,
  verifyRazorpayDepositPayment,
};