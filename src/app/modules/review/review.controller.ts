import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { ReviewServices } from './review.service';
import { IJwtPayload } from '../auth/auth.interface';

const createReview = catchAsync(async (req, res) => {
   const user = req.user;
   const review = req.body;
   const result = await ReviewServices.createReview(review, user as IJwtPayload);

   sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Review created successfully',
      data: result,
   });
});
const getAllReviews = catchAsync(async (req, res) => {
   const result = await ReviewServices.getAllReviews(req.query);

   sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Reviews fetched successfully',
      meta: result.meta,
      data: result.result,
   });
});

const editReview = catchAsync(async (req, res) => {
   const { reviewId } = req.params;
   const result = await ReviewServices.editReview(reviewId, req.body, req.user as IJwtPayload);

   sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Review updated successfully',
      data: result,
   });
});

const deleteReview = catchAsync(async (req, res) => {
   const { reviewId } = req.params;
   const result = await ReviewServices.deleteReview(reviewId, req.user as IJwtPayload);

   sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Review deleted successfully',
      data: result,
   });
});

export const ReviewControllers = {
   createReview,
   getAllReviews,
   editReview,
   deleteReview,
};
