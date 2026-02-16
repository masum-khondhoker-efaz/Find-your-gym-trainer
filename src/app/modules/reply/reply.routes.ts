import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { replyController } from './reply.controller';
import { replyValidation } from './reply.validation';

const router = express.Router();

router.post(
'/',
auth(),
validateRequest(replyValidation.createSchema),
replyController.createReply,
);

router.get('/', auth(), replyController.getReplyList);

router.get('/:id', auth(), replyController.getReplyById);

router.put(
'/:id',
auth(),
validateRequest(replyValidation.updateSchema),
replyController.updateReply,
);

router.delete('/:id', auth(), replyController.deleteReply);

export const replyRoutes = router;