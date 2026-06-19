import { Router } from 'express';
import { OrderController } from './order.controller';
import auth from '../../middleware/auth';
import { UserRole } from '../user/user.interface';

const router = Router();

// Define routes
router.get(
    '/my-shop-orders',
    auth(UserRole.USER),
    OrderController.getMyShopOrders
);

router.get(
    '/my-orders',
    auth(UserRole.USER),
    OrderController.getMyOrders
);

router.get(
    '/',
    auth(UserRole.ADMIN),
    OrderController.getAllOrders
);

router.get(
    '/:orderId',
    auth(UserRole.USER, UserRole.ADMIN),
    OrderController.getOrderDetails
);

router.post(
    '/',
    auth(UserRole.USER),
    OrderController.createOrder
)

router.patch(
    '/:orderId/status',
    auth(UserRole.ADMIN),
    OrderController.changeOrderStatus
)

export const OrderRoutes = router;
