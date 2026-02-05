import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { subscriptionPricingRuleService } from './subscriptionPricingRule.service';

const createSubscriptionPricingRule = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result =
    await subscriptionPricingRuleService.createSubscriptionPricingRuleIntoDb(
      user.id,
      req.body,
    );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Subscription pricing rule created successfully',
    data: result,
  });
});

const getSubscriptionPricingRuleList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result =
    await subscriptionPricingRuleService.getSubscriptionPricingRuleListFromDb(
      user.id,
    );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription pricing rules retrieved successfully',
    data: result,
  });
});

const getSubscriptionPricingRuleById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result =
    await subscriptionPricingRuleService.getSubscriptionPricingRuleByIdFromDb(
      user.id,
      req.params.id,
    );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription pricing rule details retrieved successfully',
    data: result,
  });
});

const updateSubscriptionPricingRule = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result =
    await subscriptionPricingRuleService.updateSubscriptionPricingRuleIntoDb(
      user.id,
      req.params.id,
      req.body,
    );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription pricing rule updated successfully',
    data: result,
  });
});

const deleteSubscriptionPricingRule = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result =
    await subscriptionPricingRuleService.deleteSubscriptionPricingRuleItemFromDb(
      user.id,
      req.params.id,
    );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription pricing rule deleted successfully',
    data: result,
  });
});

const getApplicablePricingRules = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { subscriptionOfferId } = req.query;

  if (!subscriptionOfferId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Subscription offer ID is required',
      data: null,
    });
  }

  const result =
    await subscriptionPricingRuleService.getApplicablePricingRulesForTrainer(
      user.id,
      subscriptionOfferId as string,
    );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Applicable pricing rules retrieved successfully',
    data: result,
  });
});

const applyPricingRule = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await subscriptionPricingRuleService.applyPricingRule(
    user.id,
    req.body.pricingRuleId,
    req.body.subscriptionId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Pricing rule applied successfully',
    data: result,
  });
});

export const subscriptionPricingRuleController = {
  createSubscriptionPricingRule,
  getSubscriptionPricingRuleList,
  getSubscriptionPricingRuleById,
  updateSubscriptionPricingRule,
  deleteSubscriptionPricingRule,
  getApplicablePricingRules,
  applyPricingRule,
};