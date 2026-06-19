import { StatusCodes } from 'http-status-codes';
import { IReview } from './review.interface';
import { Review } from './review.model';
import { IJwtPayload } from '../auth/auth.interface';
import AppError from '../../errors/appError';
import QueryBuilder from '../../builder/QueryBuilder';
import mongoose from 'mongoose';
import { Product } from '../product/product.model';

//@ need to fix
const createReview = async (payload: IReview, user: IJwtPayload) => {
   const session = await mongoose.startSession();

   try {
      session.startTransaction();

      const existingReview = await Review.findOne(
         {
            user: user.userId,
            product: payload.product,
         },
         null,
         { session }
      );

      if (existingReview) {
         throw new AppError(
            StatusCodes.BAD_REQUEST,
            'You have already reviewed this product.'
         );
      }

      const review = await Review.create([{ ...payload, user: user.userId }], {
         session,
      });

      // Aggregate reviews for the product
      const reviews = await Review.aggregate([
         {
            $match: {
               product: review[0].product,
            },
         },
         {
            $group: {
               _id: null,
               averageRating: { $avg: '$rating' },
               ratingCount: { $sum: 1 },
            },
         },
      ]);

      const { averageRating = 0, ratingCount = 0 } = reviews[0] || {};

      const updatedProduct = await Product.findByIdAndUpdate(
         payload.product,
         { averageRating, ratingCount },
         { session, new: true }
      );

      if (!updatedProduct) {
         throw new AppError(
            StatusCodes.NOT_FOUND,
            'Product not found during rating update.'
         );
      }

      await session.commitTransaction();
      return review;
   } catch (err) {
      await session.abortTransaction();
      throw err;
   } finally {
      session.endSession();
   }
};

const getAllReviews = async (query: Record<string, unknown>) => {
   const brandQuery = new QueryBuilder(
      Review.find().populate('product user'),
      query
   )
      .search(['review'])
      .filter()
      .sort()
      .paginate()
      .fields();

   const result = await brandQuery.modelQuery;
   const meta = await brandQuery.countTotal();

   return {
      meta,
      result,
   };
};

const editReview = async (reviewId: string, payload: Partial<IReview>, authUser: IJwtPayload) => {
   const review = await Review.findById(reviewId);
   if (!review) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Review not found');
   }

   if (review.user.toString() !== authUser.userId) {
      throw new AppError(StatusCodes.FORBIDDEN, 'You can only edit your own reviews');
   }

   if (payload.review !== undefined) {
      review.review = payload.review;
   }
   if (payload.rating !== undefined) {
      review.rating = payload.rating;
   }

   const updatedReview = await review.save();
   return updatedReview;
};

const deleteReview = async (reviewId: string, authUser: IJwtPayload) => {
   const review = await Review.findById(reviewId);
   if (!review) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Review not found');
   }

   if (authUser.role !== 'admin' && review.user.toString() !== authUser.userId) {
      throw new AppError(StatusCodes.FORBIDDEN, 'You do not have permission to delete this review');
   }

   const productId = review.product;
   await Review.findByIdAndDelete(reviewId);

   // Recalculate average rating after deletion
   await (Review as any).calculateAverageRating(productId);

   return { message: 'Review deleted successfully' };
};

export const ReviewServices = {
   createReview,
   getAllReviews,
   editReview,
   deleteReview,
};
