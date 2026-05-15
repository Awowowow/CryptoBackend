import AppError from "../utils/appError.js";
import {
  signupUser,
  loginUser,
  refreshUserToken,
  verifyEmailToken,
  logoutUser,
  requestPasswordReset,
  resetUserPassowrd,
} from "../services/auth-service/auth.service.js";
import asyncWrapper from "../utils/asyncWrapper.js";
import { COOKIE_OPTIONS } from "../utils/consts.js";

const validateSignupInput = ({ email, password }) => {
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }

  if (typeof email !== "string" || typeof password !== "string") {
    throw new AppError("Invalid input format", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail.includes("@")) {
    throw new AppError("Email must be valid", 400);
  }

  if (password.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400);
  }

  return {
    email: normalizedEmail,
    password,
  };
};

const validateLoginInput = ({ email, password }) => {
  if (!email || !password) {
    throw new AppError("Email and password are required", 400);
  }
  return {
    email: email.trim().toLowerCase(),
    password,
  };
};

const validateteForgotPasswordInput = ({email}) =>{
  if (!email) {
    throw new AppError("Email is required", 400);
  }

  if (typeof email !== "string") {
    throw new AppError("Invalid input format", 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail.includes("@")) {
    throw new AppError("Email must be valid", 400);
  }

  return {
    email: normalizedEmail,
  };
}

const validateResetPasswordInput = ({ token, newPassword }) => {
  if (!token || !newPassword) {
    throw new AppError("Token and new password are required", 400);
  }

  if (typeof token !== "string" || typeof newPassword !== "string") {
    throw new AppError("Invalid input format", 400);
  }

  if (newPassword.length < 8) {
    throw new AppError("Password must be at least 8 characters", 400);
  }

  return {
    token: token.trim(),
    newPassword,
  };
};


const signup = async (req, res) => {
  const payload = validateSignupInput(req.body ?? {});
  const user = await signupUser(payload);

  res.status(201).json({
    success: true,
    message: "User created successfull, Please verify your email",
    data: user,
  });
};

const emailVerification = asyncWrapper(async (req, res) => {
  const token = String(req.query.token || "").trim();

  if (!token) {
    throw new AppError("Verification token is required", 400);
  }

  await verifyEmailToken(token);
  res.status(200).json({
    success: true,
    message: "Email verified successfully",
  });
});

const forgotPassword = (async(req,res) =>{
  const payload = validateteForgotPasswordInput(req.body ?? {});

  await requestPasswordReset(payload.email);

  res.status(200).json({
    success: true,
    message: "If an account exists, a password reset link has been sent",
  });
})

const resetPassword = (async(req,res) =>{
  const payload = validateResetPasswordInput(req.body ?? {});

  await resetUserPassowrd(payload.token, payload.newPassword);

  res.status(200).json({
    success: true,
    message: "Password reset successfully, Please log in again.",
  });
})

const login = asyncWrapper(async (req, res) => {
  const payload = validateLoginInput(req.body ?? {});

  const result = await loginUser({
    ...payload,
    trustedDeviceToken: req.cookies.trustedDeviceToken,
  });

  if (result.requiresTwoFa) {
    return res.status(200).json({
      success: true,
      requiresTwoFa: true,
      message: "2FA verification required",
      data: {
        twoFaToken: result.twoFaToken,
      },
    });
  }

  res.cookie("accessToken", result.accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", result.refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    requiresTwoFa: false,
    message: "User logged in successfully",
    data: result.user,
  });
});

const logout = asyncWrapper(async (req, res) => {
  await logoutUser(req.cookies.refreshToken);

  res.clearCookie("accessToken", COOKIE_OPTIONS);
  res.clearCookie("refreshToken", COOKIE_OPTIONS);

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

const refresh = asyncWrapper(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken;

  if (!incomingRefreshToken) {
    throw new AppError("Session expired", 401);
  }
  const { accessToken, refreshToken: rotatedRefreshToken } =
    await refreshUserToken(incomingRefreshToken);

  res.cookie("accessToken", accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
  res.cookie("refreshToken", rotatedRefreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(200).json({
    success: true,
    message: "Token refreshed successfully",
  });
});

export { signup, login, logout, refresh, emailVerification, forgotPassword, resetPassword };
