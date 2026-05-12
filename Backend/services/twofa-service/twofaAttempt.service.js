import redisClient from "../../config/redis.js";
import AppError from "../../utils/AppError.js";

const MAX_TWO_FA_ATTEMPTS = 5;
const TWO_FA_ATTEMPT_WINDOW_SECONDS = 10 * 60;


const buildTwoFaAttemptKey = ({purpose, identifier}) =>{
    return `twofa:attempts:${purpose}:${identifier}`;
}

const checkTwoFaAttempts = async({purpose, identifier}) => {
    const key = buildTwoFaAttemptKey({purpose, identifier});
    const attempts = Number(await redisClient.get(key) || 0);
    if(attempts >= MAX_TWO_FA_ATTEMPTS){
        throw new AppError("Too many 2FA attempts. Please try again later.", 429);
    };
}

const recordFailedTwoFaAttempt = async({purpose, identifier}) => {
    const key = buildTwoFaAttemptKey({purpose, identifier});
    const attempts = await redisClient.incr(key);
    if(attempts === 1){
        await redisClient.expire(key, TWO_FA_ATTEMPT_WINDOW_SECONDS);
    }
    if (attempts >= MAX_TWO_FA_ATTEMPTS) {
        throw new AppError("Too many 2FA attempts. Please try again later.", 429);
      }
}

const clearTwoFaAttempts = async ({ purpose, identifier }) => {
    const key = buildTwoFaAttemptKey({ purpose, identifier });
  
    await redisClient.del(key);
  };

export {recordFailedTwoFaAttempt, clearTwoFaAttempts,checkTwoFaAttempts}