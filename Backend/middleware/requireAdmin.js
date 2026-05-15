import { UserRole } from "@prisma/client";
import prisma from "../config/prisma.js";
import asyncWrapper from "../utils/asyncWrapper.js";
import AppError from "../utils/appError.js";

const requireAdmin = asyncWrapper(async (req, _res, next) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new AppError("Authentication required", 401);
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      role: true,
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.role !== UserRole.ADMIN) {
    throw new AppError("Admin access required", 403);
  }

  next();
});

export default requireAdmin;
