import express from 'express';
import { UserRouters } from '../modules/user/user.routes';
import { AuthRouters } from '../modules/auth/auth.routes';
import { specialtiesRoutes } from '../modules/specialties/specialties.routes';
import { serviceTypesRoutes } from '../modules/serviceTypes/serviceTypes.routes';
import { termAndConditionRoutes } from '../modules/termAndCondition/termAndCondition.routes';
import { privacyPolicyRoutes } from '../modules/privacyPolicy/privacyPolicy.routes';
import { reviewRoutes } from '../modules/review/review.routes';
// import { categoryRoutes } from '../modules/category/category.routes';

import { aboutUsRoutes } from '../modules/aboutUs/aboutUs.routes';
// import { helpAndSupportRoutes } from '../modules/helpAndSupport/helpAndSupport.routes';
import { faqRoutes } from '../modules/faq/faq.routes';

// import { checkoutRoutes } from '../modules/checkout/checkout.routes';
// import { favoriteProductRoutes } from '../modules/favoriteProduct/favoriteProduct.routes';
import { foundingTeamRoutes } from '../modules/foundingTeam/foundingTeam.routes';
import { adminRoutes } from '../modules/admin/admin.routes';
import { socialRoutes } from '../modules/social/social.routes';
import { postRoutes } from '../modules/post/post.routes';
import { likeRoutes } from '../modules/like/like.routes';
import { commentRoutes } from '../modules/comment/comment.routes';
import { shareRoutes } from '../modules/share/share.routes';
import { productRoutes } from '../modules/product/product.routes';
import { customPricingRoutes } from '../modules/customPricing/customPricing.routes';
import { trainersRoutes } from '../modules/trainers/trainers.routes';
import { favoriteTrainerRoutes } from '../modules/favoriteTrainer/favoriteTrainer.routes';
import { favoriteProductRoutes } from '../modules/favoriteProduct/favoriteProduct.routes';
import { favoriteGymRoutes } from '../modules/favoriteGym/favoriteGym.routes';
import { subscriptionOfferRoutes } from '../modules/subscriptionOffer/subscriptionOffer.routes';
import { userSubscriptionRoutes } from '../modules/userSubscription/userSubscription.routes';
import { referralRoutes } from '../modules/referral/referral.routes';
import { appliedReferralRoutes } from '../modules/appliedReferral/appliedReferral.routes';
import { referralRewardSettingsRoutes } from '../modules/referralRewardSettings/referralRewardSettings.routes';
import { subscriptionPricingRuleRoutes } from '../modules/subscriptionPricingRule/subscriptionPricingRule.routes';
import { contactUsInfoRoutes } from '../modules/contactUsInfo/contactUsInfo.routes';
import { newsletterSubscriberRoutes } from '../modules/newsletterSubscriber/newsletterSubscriber.routes';
import { supportRoutes } from '../modules/support/support.routes';
import { gymRoutes } from '../modules/gym/gym.routes';
import { ordersRoutes } from '../modules/orders/orders.routes';
import { disclaimerRoutes } from '../modules/disclaimer/disclaimer.routes';
// import { PaymentRoutes } from '../modules/payment/payment.routes';
// import { orderRoutes } from '../modules/order/order.routes';

const router = express.Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRouters,
  },
  {
    path: '/admin',
    route: adminRoutes,
  },
  {
    path: '/users',
    route: UserRouters,
  },
  // {
  //   path: '/notifications',
  //   route: NotificationRoutes,
  // },
  {
    path: '/products',
    route: productRoutes,
  },
  {
    path: '/orders',
    route: ordersRoutes,
  },
  {
    path: '/custom-pricing',
    route: customPricingRoutes,
  },
  {
    path: '/custom-pricings',
    route: customPricingRoutes,
  },
  {
    path: '/terms-&-conditions',
    route: termAndConditionRoutes,
  },
  {
    path: '/privacy-policy',
    route: privacyPolicyRoutes,
  },
  {
    path: '/about-us',
    route: aboutUsRoutes,
  },
  // {
  //   path: '/help-and-support',
  //   route: helpAndSupportRoutes,
  // },
  {
    path: '/faqs',
    route: faqRoutes,
  },
  {
    path: '/reviews',
    route: reviewRoutes,
  },
  // {
  //   path: '/categories',
  //   route: categoryRoutes,
  // },
  {
    path: '/favorite-products',
    route: favoriteProductRoutes,
  },
  {
    path: '/favorite-trainers',
    route: favoriteTrainerRoutes,
  },
  {
    path: '/favorite-gyms',
    route: favoriteGymRoutes,
  },

  {
    path: '/founding-teams',
    route: foundingTeamRoutes,
  },
  {
    path: '/contact-us-info',
    route: contactUsInfoRoutes,
  },
  {
    path: '/disclaimer',
    route: disclaimerRoutes,
  },
  {
    path: '/newsletter-subscriber',
    route: newsletterSubscriberRoutes,
  },
  {
    path: '/support',
    route: supportRoutes,
  },
  {
    path: '/gyms',
    route: gymRoutes,
  },
  // {
  //   path: '/payments',
  //   route: PaymentRoutes,
  // },
  {
    path: '/specialties',
    route: specialtiesRoutes,
  },
  {
    path: '/service-types',
    route: serviceTypesRoutes,
  },
  {
    path: '/socials',
    route: socialRoutes,
  },
  {
    path: '/posts',
    route: postRoutes,
  },
  {
    path: '/likes',
    route: likeRoutes,
  },
  {
    path: '/comments',
    route: commentRoutes,
  },
  {
    path: '/shares',
    route: shareRoutes,
  },
  {
    path: '/trainers',
    route: trainersRoutes,
  },
  {
    path: '/subscription-plans',
    route: subscriptionOfferRoutes,
  },
  {
    path: '/subscription-order',
    route: userSubscriptionRoutes,
  },
  {
    path: '/referrals',
    route: referralRoutes,
  },
  {
    path: '/applied-referrals',
    route: appliedReferralRoutes,
  },
  {
    path: '/referral-reward-settings',
    route: referralRewardSettingsRoutes,
  },
  {
    path: '/subscription-pricing-rules',
    route: subscriptionPricingRuleRoutes,
  },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));


export default router;
