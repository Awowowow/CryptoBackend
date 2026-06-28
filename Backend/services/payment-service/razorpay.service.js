import crypto from "crypto";
import Razorpay from "razorpay";
import AppError from "../../utils/AppError";

const getRazorpayClient = () =>{
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if(!keyId || !keySecret){
        throw new AppError("Razorpay key id or secret is not set", 500);
    }
    
    return new Razorpay({
        key_id: keyId,
        key_secret: keySecret
    });
};

const createRazorpayOrder = async (amountMinor, currency = "INR", receipt , notes = {}) =>{
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
        throw new AppError("Payment amount must be a positive integer", 400);
      }
    
    if (!currency || typeof currency !== "string") {
        throw new AppError("Payment currency is required", 400);
    }

    const razorpay = getRazorpayClient();

    return razorpay.orders.create({
        amount: amountMinor,
        currency,
        receipt,
        notes,
        payment_capture: 1,
      });
};

const verifyRazorpayCheckoutSignature = ({
    orderId,
    paymentId,
    signature,
  }) => {
    if (!orderId || !paymentId || !signature) {
      throw new AppError("Razorpay verification details are required", 400);
    }
  
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
  
    if (!keySecret) {
      throw new AppError("Razorpay secret is not configured", 500);
    }
  
    const body = `${orderId}|${paymentId}`;
  
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body)
      .digest("hex");
  
    const isValid =
      expectedSignature.length === signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );
  
    if (!isValid) {
      throw new AppError("Invalid Razorpay payment signature", 401);
    }
  
    return true;
};
  
  export {
    createRazorpayOrder,
    verifyRazorpayCheckoutSignature,
  };