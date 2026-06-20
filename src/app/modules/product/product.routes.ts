import { Router } from 'express';
import auth from '../../middleware/auth';
import { UserRole } from '../user/user.interface';
import { multerUpload } from '../../config/multer.config';
import { parseBody } from '../../middleware/bodyParser';
import { ProductController } from './product.controller';
import validateRequest from '../../middleware/validateRequest';
import { productValidation } from './product.validation';

const router = Router();

router.get('/', ProductController.getAllProduct);

router.get('/trending', ProductController.getTrendingProducts);

router.get(
   '/my-shop-products',
   auth(UserRole.USER),
   ProductController.getMyShopProducts
);

router.get(
   '/wishlist',
   auth(UserRole.USER),
   ProductController.getWishlist
);

router.post(
   '/:productId/wishlist',
   auth(UserRole.USER),
   ProductController.toggleWishlist
);

router.get('/:productId', ProductController.getSingleProduct);

router.post(
   '/',
   auth(UserRole.ADMIN, UserRole.USER),
   multerUpload.fields([{ name: 'images', maxCount: 5 }]),
   parseBody,
   validateRequest(productValidation.createProductValidationSchema),
   ProductController.createProduct
);

router.patch(
   '/:productId',
   auth(UserRole.ADMIN, UserRole.USER),
   multerUpload.fields([{ name: 'images', maxCount: 5 }]),
   parseBody,
   ProductController.updateProduct
);

router.delete(
   '/:productId',
   auth(UserRole.ADMIN, UserRole.USER),
   ProductController.deleteProduct
);
export const ProductRoutes = router;
