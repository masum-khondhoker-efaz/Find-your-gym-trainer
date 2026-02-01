import { User, UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { adminController } from './admin.controller';
import { adminValidation } from './admin.validation';

const router = express.Router();

router.get(
  '/dashboard-stats',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getDashboardStats,
);

router.get(
  '/users',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllUsers,
);
router.get(
  '/users/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAUser,
);

router.get(
  '/trainers',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllTrainers,
);

router.get(
  '/posts',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllPosts,
)

router.get(
  '/products',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllProducts,
)

router.patch(
  '/products/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  // validateRequest(adminValidation.updateProductVisibilitySchema),
  adminController.updateProductVisibility,
)

router.patch(
  '/trainers/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  // validateRequest(adminValidation.updateTrainerStatusSchema),
  adminController.updateTrainerStatus,
)
router.get(
  '/trainers/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getATrainer,
);

router.get(
  '/orders',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllOrders,
);
router.get(
  '/orders/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAOrder,
);

router.get(
  '/newsletter-subscribers',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.getAllNewsletterSubscribers,
);

router.patch(
  '/users/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.updateUserStatus,
);

router.patch(
  '/posts/:id',
  auth(UserRoleEnum.SUPER_ADMIN, UserRoleEnum.ADMIN),
  adminController.updatePostStatus,
);

router.delete('/:id', auth(), adminController.deleteAdmin);

export const adminRoutes = router;
