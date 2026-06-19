import mongoose, { Schema } from 'mongoose';
import { IUser, UserModel, UserRole } from './user.interface';
import bcrypt from 'bcrypt';
import config from '../../config';
import AppError from '../../errors/appError';
import { StatusCodes } from 'http-status-codes';

// Create the User schema based on the interface
const userSchema = new Schema<IUser, UserModel>(
   {
      name: {
         type: String,
         required: true,
      },
      email: {
         type: String,
         required: true,
         unique: true,
         lowercase: true,
      },
      password: {
         type: String,
         required: false,
      },
      role: {
         type: String,
         enum: [UserRole.ADMIN, UserRole.USER],
         default: UserRole.USER,
      },
      hasShop: {
         type: Boolean,
         default: false, // Default value is false
      },
      clientInfo: {
         device: {
            type: String,
            enum: ['pc', 'mobile'],
            required: true,
         },
         browser: {
            type: String,
            required: true,
         },
         ipAddress: {
            type: String,
            required: true,
         },
         pcName: {
            type: String,
         },
         os: {
            type: String,
         },
         userAgent: {
            type: String,
         },
      },
      lastLogin: {
         type: Date,
         default: Date.now,
      },
      isActive: {
         type: Boolean,
         default: true,
      },
      otpToken: {
         type: String,
         default: null
      },
      status: {
         type: String,
         enum: ['active', 'banned'],
         default: 'active'
      },
      profilePhoto: {
         type: String,
         default: ''
      },
      refreshTokenHash: {
         type: String,
         default: null
      },
      wishlist: [{
         type: Schema.Types.ObjectId,
         ref: 'Product'
      }]
   },
   {
      timestamps: true,
   }
);

userSchema.pre('save', async function (next) {
   const user = this;

   if (user.password) {
      user.password = await bcrypt.hash(
         user.password,
         Number(config.bcrypt_salt_rounds)
      );
   }

   next();
});

userSchema.post('save', function (doc, next) {
   doc.password = '';
   next();
});

userSchema.set('toJSON', {
   transform: (_doc, ret) => {
      delete ret.password;
      return ret;
   },
});

userSchema.statics.isPasswordMatched = async function (
   plainTextPassword,
   hashedPassword
) {
   return await bcrypt.compare(plainTextPassword, hashedPassword);
};

userSchema.statics.isUserExistsByEmail = async function (email: string) {
   return await User.findOne({ email }).select('+password');
};

userSchema.statics.checkUserExist = async function (userId: string) {
   const existingUser = await this.findById(userId);

   if (!existingUser) {
      throw new AppError(StatusCodes.NOT_ACCEPTABLE, 'User does not exist!');
   }

   if (!existingUser.isActive) {
      throw new AppError(StatusCodes.NOT_ACCEPTABLE, 'User is not active!');
   }

   return existingUser;
};

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, status: 1 });

const User = mongoose.model<IUser, UserModel>('User', userSchema);
export default User;
