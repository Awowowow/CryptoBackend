import qrcode from "qrcode";
import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";
import { encryptText, decryptText } from "../../utils/encryption.js";
import validateOtp from "../../utils/validateOtp.js";
import { authenticator } from "@otplib/preset-default";

const TWO_FA_ISSUER = "Crypto Exchange";

authenticator.options = {
    step: 30,
    digits: 6,
    window: 1,
  };

const setupTwoFa = async (userId) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        twoFaSecret: true,
      },
    });
  
    if (!user) {
      throw new AppError("User not found", 404);
    }
  
    if (user.isTwoFaEnabled) {
      throw new AppError("2FA is already enabled", 409);
    }
  
    const secret = authenticator.generateSecret();
    const encryptedSecret = encryptText(secret);
  
    await prisma.twoFaSecret.upsert({
      where: { userId },
      update: {
        secretEncrypted: encryptedSecret,
        backupCodesHash: [],
        isVerified: false,
      },
      create: {
        userId,
        secretEncrypted: encryptedSecret,
        backupCodesHash: [],
        isVerified: false,
      },
    });
  
    const otpauthUrl = authenticator.keyuri(
      user.email,
      TWO_FA_ISSUER,
      secret
    );
  
    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);
  
    return {
      qrCodeDataUrl,
      manualEntryKey: secret,
    };
  };
  
const verifyTwoFaSetup = async ({ userId, otp }) => {
    const normalizedOtp = validateOtp(otp);
  
    const twoFaSecret = await prisma.twoFaSecret.findUnique({
      where: { userId },
    });
  
    if (!twoFaSecret) {
      throw new AppError("2FA setup has not been started", 400);
    }
  
    if (twoFaSecret.isVerified) {
      throw new AppError("2FA setup is already verified", 409);
    }
  
    const secret = decryptText(twoFaSecret.secretEncrypted);
  
    const isValidOtp = authenticator.verify({
      token: normalizedOtp,
      secret,
    });
  
    if (!isValidOtp) {
      throw new AppError("Invalid 2FA code", 401);
    }
  
    await prisma.$transaction([
      prisma.twoFaSecret.update({
        where: { userId },
        data: {
          isVerified: true,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          isTwoFaEnabled: true,
        },
      }),
    ]);
  
    return {
      enabled: true,
    };
  };
  
const verifyUserTwoFaOtp = async ({ userId, otp }) => {
    const normalizedOtp = validateOtp(otp);
  
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        twoFaSecret: true,
      },
    });
  
    if (!user) {
      throw new AppError("User not found", 404);
    }
  
    if (!user.isTwoFaEnabled || !user.twoFaSecret?.isVerified) {
      throw new AppError("2FA is not enabled for this account", 400);
    }
  
    const secret = decryptText(user.twoFaSecret.secretEncrypted);
  
    const isValidOtp = authenticator.verify({
      token: normalizedOtp,
      secret,
    });
  
    if (!isValidOtp) {
      throw new AppError("Invalid 2FA code", 401);
    }
  
    return true;
  };
  
  export {
    setupTwoFa,
    verifyTwoFaSetup,
    verifyUserTwoFaOtp,
  };