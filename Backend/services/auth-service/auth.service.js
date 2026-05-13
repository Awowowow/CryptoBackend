import bcrypt from "bcrypt";
import { UserRole } from "@prisma/client";
import AppError from "../../utils/AppError.js";
import prisma from "../../config/prisma.js";
import hashToken from "../../utils/hashToken.js";
import generateRandomToken from "../../utils/tokenGenrator.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.service.js";
import { createTwoFaToken } from "../twofa-service/twofaToken.service.js";
import { verifyTrustedDevice } from "../twofa-service/trustedDevice.service.js";
import { createAuthSession,refreshAuthSession,revokeAuthSession } from "./session.service.js";


const signupUser = async ({ email, password }) => {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new AppError("User already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashedPassword,
      role: UserRole.USER,
    },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
  await prisma.authToken.deleteMany({
    where: {
      userId: user.id,
      type: "EMAIL_VERIFY",
    },
  });
  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);

  await prisma.authToken.create({
    data: {
      userId: user.id,
      type: "EMAIL_VERIFY",
      tokenHash: tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 15),
    },
  });

  try {
    await sendVerificationEmail(user.email, rawToken);
  } catch (err) {
    // optional: cleanup token
    await prisma.authToken.deleteMany({
      where: { userId: user.id, type: "EMAIL_VERIFY" },
    });
  
    throw new AppError("Failed to send verification email", 500);
  }

  return user;
};

const verifyEmailToken = async (token) => {
    const tokenHash = hashToken(token);
    
    const storedToken = await prisma.authToken.findFirst({
      where: {
        tokenHash,
        type: "EMAIL_VERIFY",
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
  
    if (!storedToken) {
      throw new AppError("Invalid or expired token", 400);
    }
  
    await prisma.user.update({
      where: { id: storedToken.userId },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  
    await prisma.authToken.deleteMany({
      where: {
        userId: storedToken.userId,
        type: "EMAIL_VERIFY",
      },
    });
  
};

const loginUser = async ({ email, password, trustedDeviceToken }) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError("Invalid Credentials", 401);
  }

  if (!user.isEmailVerified) {
    throw new AppError("Please verify your email", 403);
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError("Invalid password", 401);
  }

  if (user.isTwoFaEnabled) {
    const isTrustedDevice = await verifyTrustedDevice({
      userId: user.id,
      trustedDeviceToken,
    });

    if (!isTrustedDevice) {
      const twoFaToken = await createTwoFaToken(user.id);

      return {
        requiresTwoFa: true,
        twoFaToken,
      };
    }
  }
  const session = await createAuthSession(user);
  return {
    requiresTwoFa: false,
    ...session,
  }
};

const refreshUserToken = async (refreshToken) => {
  return refreshAuthSession(refreshToken);
};

const requestPasswordReset = async ({ email }) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return;
  }

  await prisma.authToken.deleteMany({
    where: {
      userId: user.id,
      type: "PASSWORD_RESET",
    },
  });

  const rawToken = generateRandomToken();
  const tokenHash = hashToken(rawToken);

  await prisma.authToken.create({
    data: {
      userId: user.id,
      type: "PASSWORD_RESET",
      tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 15),
    },
  });

  await sendPasswordResetEmail(user.email, rawToken);
};

const resetUserPassowrd = async({token, newPassword}) =>{
  const tokenHash = await hashToken(token);

  const storedToken = await prisma.authToken.findFirst({
    where:{
      tokenHash,
      type: "PASSWORD_RESET",
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  })

  if (!storedToken) throw new AppError("Invalid or expired token", 400)

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: storedToken.userId },
    data: {
      passwordHash: hashedPassword,
    },
  });

  await prisma.authToken.deleteMany({
    where: {
      userId: storedToken.userId,
      type: "PASSWORD_RESET",
    },
  });
}

const logoutUser = async(refreshToken) =>{
  await revokeAuthSession(refreshToken);
}

export { signupUser, loginUser, refreshUserToken,verifyEmailToken,logoutUser,requestPasswordReset,resetUserPassowrd };


