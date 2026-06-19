import { Router } from 'express';
import { MetaController } from './meta.controller';
import auth from '../../middleware/auth';
import { UserRole } from '../user/user.interface';

const router = Router();

router.get(
    '/admin',
    auth(UserRole.ADMIN),
    MetaController.getAdminMeta
);

router.get(
    '/vendor',
    auth(UserRole.USER),
    MetaController.getVendorMeta
);

export const MetaRoutes = router;
