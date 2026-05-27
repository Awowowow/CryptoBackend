import prisma from "../../config/prisma.js";
import AppError from "../../utils/AppError.js";


const getUserProfile = async(userId) =>{
    const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          email: true,
          role: true,
          isEmailVerified: true,
          emailVerifiedAt: true,
          isTwoFaEnabled: true,
          kycStatus: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

    if(!user){
        throw new AppError("User not found", 404);
    }
    return user
}

export {getUserProfile}