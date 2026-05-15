import { listTrustedDevice, revokeTrustedDevice } from "../services/twofa-service/trustedDevice.service.js";
import { setupTwoFa, verifyTwoFaSetup} from "../services/twofa-service/twofa.service.js";
import { verifyTwoFaLogin, verifyRecentTwoFa } from "../services/twofa-service/twoFaLogin.service.js";
import asyncWrapper from "../utils/asyncWrapper.js";
import { COOKIE_OPTIONS } from "../utils/consts.js";


const getClientIp = (req) => {
    return req.ip || req.socket?.remoteAddress || null;
  };

const setup = asyncWrapper(async(req , res) =>{
    const userId = req.user.userId

    const result = await setupTwoFa(userId);

    res.status(200).json({
        success: true,
        message: "2FA setup initiated successfully",
        data: result,
    })
})

const verifySetup = asyncWrapper(async(req, res) =>{
    const userId = req.user.userId;
    const {otp} = req.body ?? {};

    const result = await verifyTwoFaSetup({userId, otp});

    res.status(200).json({
        success: true,
        message: "2FA setup verified successfully",
        data: result,
    })
})

const verifyLogin = asyncWrapper(async (req, res) => {
    const { twoFaToken, otp, rememberDevice } = req.body ?? {};

    const result = await verifyTwoFaLogin({
        twoFaToken,
        otp,
        rememberDevice,
        userAgent: req.headers["user-agent"] || null,
        ipAddress: getClientIp(req),
    })

    res.cookie("accessToken", result.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    });
  
    res.cookie("refreshToken", result.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  
    if (result.trustedDeviceToken) {
        res.cookie("trustedDeviceToken", result.trustedDeviceToken, {
          ...COOKIE_OPTIONS,
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });
      }
  
      res.status(200).json({
        success: true,
        requiresTwoFa: false,
        message: "2FA verified and user logged in successfully",
        data: result.user,
      });
});

const verifyRecent = asyncWrapper(async(req,res) =>{
  const {otp} = req.body ?? {};

  const result = await verifyRecentTwoFa({
    userId: req.user.userId,
    sessionId: req.user.sessionId,
    otp,
  })

  res.status(200).json({
    success: true,
    message: "Recent 2FA verified successfully",
    data: result,
  });
});

const getTrustedDevices = asyncWrapper(async(req,res) =>{
  const userId = req.user.userId;

  const trustedDevices = await listTrustedDevice({userId});

  res.status(200).json({
    success: true,
    message: "Trusted devices fetched successfully",
    data: trustedDevices,
  });
})

const deleteTrustedDevice = asyncWrapper(async(req,res) =>{
  const userId = req.user.userId;
  const trustedDeviceId = req.params.trustedDeviceId;

  await revokeTrustedDevice({userId, trustedDeviceId});

  res.status(200).json({
    success: true,
    message: "Trusted device revoked successfully",
  });
})

export {
    setup,
    verifySetup,
    verifyLogin,
    verifyRecent,
    getTrustedDevices,
    deleteTrustedDevice
  };

