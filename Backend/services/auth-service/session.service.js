import { v4 as uuidv4 } from "uuid";
import {
    revokeRefreshToken,
    revokeToken,
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
  } from "../../utils/token.js";
import AppError from "../../utils/AppError.js";
import redisClient from "../../config/redis.js";

const createAuthSession = async (user) => {
    const sessionId = uuidv4();

    const accessToken = await signAccessToken(user.id, sessionId);
    const refreshToken = await signRefreshToken(user.id, sessionId);

    return {
        accessToken,
        refreshToken,
        sessionId,
        user: {
                id: user.id,
                email: user.email,
                role: user.role,
                isTwoFaEnabled: user.isTwoFaEnabled,
            }
        }
    }


const refreshAuthSession = async(refreshToken) =>{
    let decoded;

    try{
        decoded = await verifyRefreshToken(refreshToken);
    } catch{
        throw new AppError("Invalid refresh token", 401);
    }

    const {userId, sessionId} = decoded;

    const sessionUserId = await redisClient.get(`refresh_token:${sessionId}`);

    if(!sessionUserId){
        throw new AppError("Session expried", 401);   
    }
    if (sessionUserId !== String(userId)) {
        throw new AppError("Invalid session", 401);
      }
      
    await revokeRefreshToken(sessionId);
    await revokeToken(sessionId);

    const newSessionId = uuidv4();

    const accessToken = await signAccessToken(userId, newSessionId);
    const newRefreshToken = await signRefreshToken(userId, newSessionId);  

    return {
        accessToken,
        refreshToken: newRefreshToken,
      };
}

const revokeAuthSession = async(refreshToken) =>{
    if(!refreshToken){
        return
    }

    let decoded;

    try{
        decoded = await verifyRefreshToken(refreshToken);
    }catch{
        return;
    }
    await revokeRefreshToken(decoded.sessionId);
    await revokeToken(decoded.sessionId);
}

export {
    createAuthSession,
    refreshAuthSession,
    revokeAuthSession,
}
