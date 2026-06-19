import { Router } from 'express';
import { ReviewControllers } from './review.controller';
import auth from '../../middleware/auth';
import { UserRole } from '../user/user.interface';

const router = Router();

router.get(
    '/',
    ReviewControllers.getAllReviews
);
router.post(
    '/',
    auth(UserRole.USER),
    ReviewControllers.createReview
);
router.patch(
    '/:reviewId',
    auth(UserRole.USER),
    ReviewControllers.editReview
);
router.delete(
    '/:reviewId',
    auth(UserRole.ADMIN, UserRole.USER),
    ReviewControllers.deleteReview
);

export const ReviewRoutes = router;
