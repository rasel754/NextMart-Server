import { Schema, model } from 'mongoose';
import { IReview } from './review.interface';
import { Product } from '../product/product.model';

const reviewSchema = new Schema<IReview>(
   {
      review: {
         type: String,
         required: [true, 'Review text is required.'],
         trim: true,
      },
      rating: {
         type: Number,
         required: [true, 'Rating is required.'],
         min: [1, 'Rating must be at least 1.'],
         max: [5, 'Rating cannot be greater than 5.'],
      },
      user: {
         type: Schema.Types.ObjectId,
         ref: 'User',
         required: true,
      },
      product: {
         type: Schema.Types.ObjectId,
         ref: 'Product',
         required: true,
      },
      isFlagged: {
         type: Boolean,
         default: false,
      },
      flaggedReason: {
         type: String,
         default: '',
      },
      isVerifiedPurchase: {
         type: Boolean,
         default: false,
      },
   },
   {
      timestamps: true,
   }
);

// Indexes
reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });

// Static method to calculate average rating and rating count
reviewSchema.statics.calculateAverageRating = async function (productId: Schema.Types.ObjectId) {
   const stats = await this.aggregate([
      {
         $match: { product: productId }
      },
      {
         $group: {
            _id: '$product',
            ratingCount: { $sum: 1 },
            averageRating: { $avg: '$rating' }
         }
      }
   ]);

   if (stats.length > 0) {
      await Product.findByIdAndUpdate(productId, {
         averageRating: Math.round(stats[0].averageRating * 10) / 10,
         ratingCount: stats[0].ratingCount
      });
   } else {
      await Product.findByIdAndUpdate(productId, {
         averageRating: 0,
         ratingCount: 0
      });
   }
};

// Post-save hook to calculate average rating
reviewSchema.post('save', async function () {
   const ReviewModel = this.constructor as any;
   await ReviewModel.calculateAverageRating(this.product);
});

export const Review = model<IReview>('Review', reviewSchema);
