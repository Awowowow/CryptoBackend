import prisma from "../../config/prisma.js";
import hashToken from "../../utils/hashToken.js";
import generateRandomToken from "../../utils/tokenGenrator.js";

const TRUSTED_DEVICE_EXPIRATION_DAYS = 30; 


const createTrustedDevice = async({userId, userAgent, ipAddress}) =>{

    const rawToken = generateRandomToken();
    const tokenHash = hashToken(rawToken);

    await prisma.trustedDevice.create({
        data: {
            userId,
            tokenHash,
            userAgent,
            ipAddress,
            expiresAt: new Date(
                Date.now() + TRUSTED_DEVICE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000
            )
        },
    });

    return rawToken;
};

const verifyTrustedDevice = async({userId, trustedDeviceToken}) =>{
    if(!trustedDeviceToken){
        return false;
    }
    const tokenHash = hashToken(trustedDeviceToken);

    const trustedDevice = await prisma.trustedDevice.findFirst({
        where:{
            userId,
            tokenHash,
            revokedAt: null,
            expiresAt: {
                gt: new Date(),
            },
        }
    })

    if (!trustedDevice) {
        return false;
      }
    
    await prisma.trustedDevice.update({
        where: {
            id: trustedDevice.id,
        },
        data:{
            lastUsedAt: new Date(),
        }
    })
    return true
}

export {
    createTrustedDevice,
    verifyTrustedDevice,
  };