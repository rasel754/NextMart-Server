import { ClientSession } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/appError';
import User from '../user/user.model';
import { IAuth, IJwtPayload } from './auth.interface';
import { createToken, verifyToken } from './auth.utils';
import config from '../../config';
import mongoose from 'mongoose';
import { JwtPayload, Secret } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { generateOtp } from '../../utils/generateOtp';
import { EmailHelper } from '../../utils/emailHelper';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import Customer from '../customer/customer.model';
import { UserRole } from '../user/user.interface';

const client = new OAuth2Client(config.google_client_id);
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

const loginUser = async (payload: IAuth) => {
   const session = await mongoose.startSession();

   try {
      session.startTransaction();

      const user = await User.findOne({ email: payload.email }).session(
         session
      );
      if (!user) {
         throw new AppError(StatusCodes.NOT_FOUND, 'This user is not found!');
      }

      if (!user.isActive) {
         throw new AppError(StatusCodes.FORBIDDEN, 'This user is not active!');
      }

      if (!(await User.isPasswordMatched(payload?.password || '', user?.password || ''))) {
         throw new AppError(StatusCodes.FORBIDDEN, 'Password does not match');
      }

      const jwtPayload: IJwtPayload = {
         userId: user._id as string,
         name: user.name as string,
         email: user.email as string,
         hasShop: user.hasShop,
         isActive: user.isActive,
         role: user.role,
      };

      const accessToken = createToken(
         jwtPayload,
         config.jwt_access_secret as string,
         config.jwt_access_expires_in as string
      );

      const refreshToken = createToken(
         jwtPayload,
         config.jwt_refresh_secret as string,
         config.jwt_refresh_expires_in as string
      );

      const updateUserInfo = await User.findByIdAndUpdate(
         user._id,
         {
            clientInfo: payload.clientInfo,
            lastLogin: Date.now(),
            refreshTokenHash: hashToken(refreshToken)
         },
         { new: true, session }
      );

      await session.commitTransaction();

      return {
         accessToken,
         refreshToken,
      };
   } catch (error) {
      await session.abortTransaction();
      throw error;
   } finally {
      session.endSession();
   }
};

const refreshToken = async (token: string) => {
   let verifiedToken = null;
   try {
      verifiedToken = verifyToken(
         token,
         config.jwt_refresh_secret as Secret
      );
   } catch (err) {
      throw new AppError(StatusCodes.FORBIDDEN, 'Invalid Refresh Token');
   }

   const { userId } = verifiedToken;

   const isUserExist = await User.findById(userId);
   if (!isUserExist) {
      throw new AppError(StatusCodes.NOT_FOUND, 'User does not exist');
   }

   if (!isUserExist.isActive || isUserExist.status === 'banned') {
      throw new AppError(StatusCodes.BAD_REQUEST, 'User is not active or is banned');
   }

   const hashedOldToken = hashToken(token);
   if (isUserExist.refreshTokenHash !== hashedOldToken) {
      throw new AppError(StatusCodes.FORBIDDEN, 'Refresh Token has been invalidated or rotated');
   }

   const jwtPayload: IJwtPayload = {
      userId: isUserExist._id as string,
      name: isUserExist.name as string,
      email: isUserExist.email as string,
      hasShop: isUserExist.hasShop,
      isActive: isUserExist.isActive,
      role: isUserExist.role,
   };

   const newAccessToken = createToken(
      jwtPayload,
      config.jwt_access_secret as Secret,
      config.jwt_access_expires_in as string
   );

   const newRefreshToken = createToken(
      jwtPayload,
      config.jwt_refresh_secret as Secret,
      config.jwt_refresh_expires_in as string
   );

   await User.findByIdAndUpdate(isUserExist._id, {
      refreshTokenHash: hashToken(newRefreshToken)
   });

   return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
   };
};

const changePassword = async (
   userData: JwtPayload,
   payload: { oldPassword: string; newPassword: string }
) => {
   const { userId } = userData;
   const { oldPassword, newPassword } = payload;

   const user = await User.findOne({ _id: userId });
   if (!user) {
      throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
   }
   if (!user.isActive) {
      throw new AppError(StatusCodes.FORBIDDEN, 'User account is inactive');
   }

   if (!user.password) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'This account does not have a password set. Please log in using Google.');
   }

   // Validate old password
   const isOldPasswordCorrect = await User.isPasswordMatched(
      oldPassword,
      user.password
   );
   if (!isOldPasswordCorrect) {
      throw new AppError(StatusCodes.FORBIDDEN, 'Incorrect old password');
   }

   // Hash and update the new password
   const hashedPassword = await bcrypt.hash(
      newPassword,
      Number(config.bcrypt_salt_rounds)
   );
   await User.updateOne({ _id: userId }, { password: hashedPassword });

   return { message: 'Password changed successfully' };
};

const forgotPassword = async ({ email }: { email: string }) => {
   const user = await User.findOne({ email: email });

   if (!user) {
      throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
   }

   if (!user.isActive) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'User is not active!');
   }

   const otp = generateOtp();

   const otpToken = jwt.sign({ otp, email }, config.jwt_otp_secret as string, {
      expiresIn: '5m',
   });

   await User.updateOne({ email }, { otpToken });

   try {
      const emailContent = await EmailHelper.createEmailContent(
         { otpCode: otp, userName: user.name },
         'forgotPassword'
      );

      await EmailHelper.sendEmail(email, emailContent, "Reset Password OTP");
   } catch (error) {
      await User.updateOne({ email }, { $unset: { otpToken: 1 } });

      throw new AppError(
         StatusCodes.INTERNAL_SERVER_ERROR,
         'Failed to send OTP email. Please try again later.'
      );
   }
};

const verifyOTP = async (
   { email, otp }: { email: string, otp: string }
) => {
   const user = await User.findOne({ email: email });

   if (!user) {
      throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
   }

   if (!user.otpToken || user.otpToken === '') {
      throw new AppError(
         StatusCodes.BAD_REQUEST,
         'No OTP token found. Please request a new password reset OTP.'
      );
   }

   const decodedOtpData = verifyToken(
      user.otpToken as string,
      config.jwt_otp_secret as string
   );

   if (!decodedOtpData) {
      throw new AppError(
         StatusCodes.FORBIDDEN,
         'OTP has expired or is invalid'
      );
   }

   if (decodedOtpData.otp !== otp) {
      throw new AppError(StatusCodes.FORBIDDEN, 'Invalid OTP');
   }

   user.otpToken = null;
   await user.save();

   const resetToken = jwt.sign({ email }, config.jwt_pass_reset_secret as string, {
      expiresIn: config.jwt_pass_reset_expires_in as any,
   });

   // Return the reset token
   return {
      resetToken
   };

}

const resetPassword = async ({
   token,
   newPassword,
}: {
   token: string;
   newPassword: string;
}) => {

   const session: ClientSession = await User.startSession();

   try {
      session.startTransaction();

      const decodedData = verifyToken(
         token as string,
         config.jwt_pass_reset_secret as string
      );

      const user = await User.findOne({ email: decodedData.email, isActive: true }).session(session);

      if (!user) {
         throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
      }

      const hashedPassword = await bcrypt.hash(
         String(newPassword),
         Number(config.bcrypt_salt_rounds)
      );

      await User.updateOne({ email: user.email }, { password: hashedPassword }).session(
         session
      );

      await session.commitTransaction();

      return {
         message: 'Password changed successfully',
      };
   } catch (error) {
      await session.abortTransaction();
      throw error;
   } finally {
      session.endSession();
   }
};

const googleLogin = async (payload: { idToken: string; clientInfo: any }) => {
   const { idToken, clientInfo } = payload;
   
   let googlePayload;
   try {
      const ticket = await client.verifyIdToken({
         idToken,
         audience: config.google_client_id,
      });
      googlePayload = ticket.getPayload();
   } catch (error) {
      throw new AppError(StatusCodes.UNAUTHORIZED, 'Invalid Google ID token');
   }

   if (!googlePayload || !googlePayload.email) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Email is required from Google profile');
   }

   const email = googlePayload.email;
   const name = googlePayload.name || 'Google User';
   const picture = googlePayload.picture || '';

   let user = await User.findOne({ email });
   if (!user) {
      user = await User.create({
         name,
         email,
         role: UserRole.USER,
         isActive: true,
         status: 'active',
         profilePhoto: picture,
         clientInfo: clientInfo || {
            device: 'pc',
            browser: 'Google Sign-In',
            ipAddress: '127.0.0.1',
            userAgent: 'Google Auth'
         }
      });
      
      await Customer.create({
         user: user._id,
      });
   } else {
      if (!user.isActive) {
         throw new AppError(StatusCodes.FORBIDDEN, 'User account is inactive');
      }
      if (user.status === 'banned') {
         throw new AppError(StatusCodes.FORBIDDEN, 'User account is banned');
      }
   }

   const jwtPayload: IJwtPayload = {
      userId: user._id as string,
      name: user.name as string,
      email: user.email as string,
      hasShop: user.hasShop,
      isActive: user.isActive,
      role: user.role,
   };

   const accessToken = createToken(
      jwtPayload,
      config.jwt_access_secret as string,
      config.jwt_access_expires_in as string
   );

   const refreshToken = createToken(
      jwtPayload,
      config.jwt_refresh_secret as string,
      config.jwt_refresh_expires_in as string
   );

   await User.findByIdAndUpdate(user._id, {
      lastLogin: Date.now(),
      refreshTokenHash: hashToken(refreshToken),
      ...(clientInfo ? { clientInfo } : {})
   });

   return {
      accessToken,
      refreshToken
   };
};

const logoutUser = async (userId: string) => {
   const user = await User.findById(userId);
   if (!user) {
      throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
   }

   user.refreshTokenHash = null;
   await user.save();
   return { message: 'Logged out successfully' };
};

export const AuthService = {
   loginUser,
   refreshToken,
   changePassword,
   forgotPassword,
   verifyOTP,
   resetPassword,
   googleLogin,
   logoutUser,
};
