import { Schema, model } from 'mongoose';
import { ICoupon } from './coupon.interface';

const couponSchema = new Schema<ICoupon>(
   {
      code: {
         type: String,
         required: true,
         unique: true,
         uppercase: true,
         trim: true,
      },
      shop: {
         type: Schema.Types.ObjectId,
         ref: 'Shop',
         required: true,
      },
      discountType: {
         type: String,
         enum: ['Flat', 'Percentage'],
         required: true,
      },
      discountValue: {
         type: Number,
         required: true,
         min: 0,
      },
      minOrderAmount: {
         type: Number,
         default: 0,
         min: 0,
      },
      maxDiscountAmount: {
         type: Number,
         default: null,
         min: 0,
      },
      startDate: {
         type: Date,
         required: true,
      },
      endDate: {
         type: Date,
         required: true,
      },
      isActive: {
         type: Boolean,
         default: true,
      },
      isDeleted: {
         type: Boolean,
         default: false,
      },
      usageLimit: {
         type: Number,
         default: null,
      },
      usageCount: {
         type: Number,
         default: 0,
      },
      perUserLimit: {
         type: Number,
         default: 1,
      },
      minimumOrderAmount: {
         type: Number,
         default: 0,
      },
      expiresAt: {
         type: Date,
         required: true,
      },
   },
   {
      timestamps: true,
   }
);

couponSchema.pre('validate', function (next) {
   if (this.minOrderAmount !== undefined && (this.minimumOrderAmount === undefined || this.minimumOrderAmount === 0)) {
      this.minimumOrderAmount = this.minOrderAmount;
   }
   if (this.endDate && !this.expiresAt) {
      this.expiresAt = this.endDate;
   }
   next();
});

couponSchema.pre('find', function (next) {
   this.find({ isDeleted: { $ne: true } });
   next();
});

couponSchema.pre('findOne', function (next) {
   this.find({ isDeleted: { $ne: true } });
   next();
});

couponSchema.pre('aggregate', function (next) {
   this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
   next();
});

export const Coupon = model<ICoupon>('Coupon', couponSchema);
