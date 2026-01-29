import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { postController } from './post.controller';
import { postValidation } from './post.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  validateRequest(postValidation.createSchema),
  postController.createPost,
);

router.get('/', auth(), postController.getPostList);

router.get('/:id', auth(), postController.getPostById);

router.put(
  '/:id',
  auth(),
  validateRequest(postValidation.updateSchema),
  postController.updatePost,
);

router.delete('/:id', auth(), postController.deletePost);

export const postRoutes = router;
