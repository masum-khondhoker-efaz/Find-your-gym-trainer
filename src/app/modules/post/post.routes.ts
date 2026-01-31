import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { postController } from './post.controller';
import { postValidation } from './post.validation';
import { multerUploadMultiple } from '../../utils/multipleFile';
import { parseBody } from '../../middlewares/parseBody';

const router = express.Router();

router.post(
  '/',
  multerUploadMultiple.single('post-media'),
  parseBody,
  auth(),
  validateRequest(postValidation.createSchema),
  postController.createPost,
);

router.get('/', postController.getPostList);

router.get('/my-posts', auth(), postController.getMyPosts);

router.get('/my-posts/:id', auth(), postController.getAMyPostById);

router.get('/trainer-posts/:trainerId', postController.getTrainerPosts);


router.get('/:id', auth(), postController.getPostById);

router.patch(
  '/:id',
  multerUploadMultiple.single('post-media'),
  parseBody,
  auth(),
  validateRequest(postValidation.updateSchema),
  postController.updatePost,
);

router.delete('/:id', auth(), postController.deletePost);

export const postRoutes = router;
