import { Router } from 'express';
import { FlashSaleController } from './flashSale.controller';
import auth from '../../middleware/auth';
import { UserRole } from '../user/user.interface';

const router = Router();

router.get('/active', FlashSaleController.getActiveFlashSalesService);
router.get(
    '/all-schedules',
    auth(UserRole.ADMIN, UserRole.USER),
    FlashSaleController.getAllFlashSalesSchedules
);
router.get('/', FlashSaleController.getActiveFlashSalesService);

router.post(
    '/',
    auth(UserRole.USER),
    FlashSaleController.createFlashSale
);

router.patch(
    '/:id',
    auth(UserRole.ADMIN, UserRole.USER),
    FlashSaleController.updateFlashSale
);

router.delete(
    '/:id',
    auth(UserRole.ADMIN, UserRole.USER),
    FlashSaleController.deleteFlashSale
);

export const FlashSaleRoutes = router;
