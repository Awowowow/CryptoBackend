import AppError from "../../utils/AppError.js";
import { createAuthSession } from "../auth-service/session.service.js";
import { verifyUserTwoFaOtp } from "./twofa.service.js";
import {
  markTwoFaTokenUsed,
  verifyTwoFaToken,
} from "./twofaToken.service.js";
import { createTrustedDevice } from "./trustedDevice.service.js";
import { markRecentTwoFa } from "./recentTwoFa.service.js";
import {
  checkTwoFaAttempts,
  clearTwoFaAttempts,
  recordFailedTwoFaAttempt,
} from "./twofaAttempt.service.js";


const verifyTwoFaLogin = async({twoFaToken,otp,rememberDevice,userAgent,ipAddress}) =>{
    if(!twoFaToken){
        throw new AppError("2FA token is required",400)
    }

    const storedToken = await verifyTwoFaToken(twoFaToken);

    const attemptScope = {
      purpose: "login",
      identifier: storedToken.id,
    };

    await checkTwoFaAttempts(attemptScope);

    try{
      await verifyUserTwoFaOtp({
        userId: storedToken.userId,
        otp,
    });
    }catch(error){
      await recordFailedTwoFaAttempt(attemptScope);
      throw error
    }
    await clearTwoFaAttempts(attemptScope);

    await markTwoFaTokenUsed(storedToken.id);
    const session = await createAuthSession(storedToken.user);

    await markRecentTwoFa({
        userId: storedToken.userId,
        sessionId: session.sessionId,
      });

    let trustedDeviceToken = null;

    if(rememberDevice === true){
        trustedDeviceToken = await createTrustedDevice({
            userId: storedToken.userId,
            userAgent,
            ipAddress
        })
    }

    return{
        ...session,
        trustedDeviceToken,
    }
}

const verifyRecentTwoFa = async ({ userId, sessionId, otp }) => {
  const attemptScope = {
    purpose: "recent",
    identifier: `${userId}:${sessionId}`,
  };

  await checkTwoFaAttempts(attemptScope);

  try{
    await verifyUserTwoFaOtp({
      userId,
      otp,
    });
  }catch(error){
    await recordFailedTwoFaAttempt(attemptScope);
    throw error
  }
  
  await clearTwoFaAttempts(attemptScope);
    await markRecentTwoFa({
      userId,
      sessionId,
    });
  
    return {
      verified: true,
    };
  };
  
export { verifyTwoFaLogin,verifyRecentTwoFa };