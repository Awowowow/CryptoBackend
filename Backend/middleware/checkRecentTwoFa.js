import { requireRecentTwoFa } from "../services/twofa-service/recentTwoFa.service.js";

const checkRecentTwoFa = async (req, res, next) => {
    try{
        await requireRecentTwoFa({
            userId: req.user.userId,
            sessionId: req.user.sessionId,
        })
        next();
    } 
    catch(error){
        next(error);
    }
}
export default checkRecentTwoFa