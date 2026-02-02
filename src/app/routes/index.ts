import express from 'express';
import { UserRouters } from '../modules/user/user.routes';
import { AuthRouters } from '../modules/auth/auth.routes';
import { specialtiesRoutes } from '../modules/specialties/specialties.routes';
import { serviceTypesRoutes } from '../modules/serviceTypes/serviceTypes.routes';
// import { termAndConditionRoutes } from '../modules/termAndCondition/termAndCondition.routes';
// import { privacyPolicyRoutes } from '../modules/privacyPolicy/privacyPolicy.routes';
// import { reviewRoutes } from '../modules/review/review.routes';
// import { categoryRoutes } from '../modules/category/category.routes';

// import { aboutUsRoutes } from '../modules/aboutUs/aboutUs.routes';
// import { helpAndSupportRoutes } from '../modules/helpAndSupport/helpAndSupport.routes';
// import { faqRoutes } from '../modules/faq/faq.routes';

// import { checkoutRoutes } from '../modules/checkout/checkout.routes';
// import { favoriteProductRoutes } from '../modules/favoriteProduct/favoriteProduct.routes';
// import { foundingTeamRoutes } from '../modules/foundingTeam/foundingTeam.routes';
import { adminRoutes } from '../modules/admin/admin.routes';
import { socialRoutes } from '../modules/social/social.routes';
import { postRoutes } from '../modules/post/post.routes';
import { likeRoutes } from '../modules/like/like.routes';
import { commentRoutes } from '../modules/comment/comment.routes';
import { shareRoutes } from '../modules/share/share.routes';
import { productRoutes } from '../modules/product/product.routes';
import { path } from 'pdfkit';
import { trainersRoutes } from '../modules/trainers/trainers.routes';
import { favoriteTrainerRoutes } from '../modules/favoriteTrainer/favoriteTrainer.routes';
import { favoriteProductRoutes } from '../modules/favoriteProduct/favoriteProduct.routes';
import { subscriptionOfferRoutes } from '../modules/subscriptionOffer/subscriptionOffer.routes';
import { userSubscriptionRoutes } from '../modules/userSubscription/userSubscription.routes';
// import { contactUsInfoRoutes } from '../modules/contactUsInfo/contactUsInfo.routes';
// import { newsletterSubscriberRoutes } from '../modules/newsletterSubscriber/newsletterSubscriber.routes';
// import { supportRoutes } from '../modules/support/support.routes';
// import { addressRoutes } from '../modules/address/address.routes';
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
  // {
  //   path: '/terms-&-conditions',
  //   route: termAndConditionRoutes,
  // },
  // {
  //   path: '/privacy-policy',
  //   route: privacyPolicyRoutes,
  // },
  // {
  //   path: '/about-us',
  //   route: aboutUsRoutes,
  // },
  // {
  //   path: '/help-and-support',
  //   route: helpAndSupportRoutes,
  // },
  // {
  //   path: '/faqs',
  //   route: faqRoutes,
  // },
  // {
  //   path: '/reviews',
  //   route: reviewRoutes,
  // },
  // {
  //   path: '/categories',
  //   route: categoryRoutes,
  // },
  // {
  //   path: '/car-brands',
  //   route: carBrandRoutes,
  // },
  {
    path: '/favorite-products',
    route: favoriteProductRoutes,
  },
  {
    path: '/favorite-trainers',
    route: favoriteTrainerRoutes,
  },

  // {
  //   path: '/founding-teams',
  //   route: foundingTeamRoutes,
  // },
  // {
  //   path: '/contact-us-info',
  //   route: contactUsInfoRoutes,
  // },
  // {
  //   path: '/newsletter-subscriber',
  //   route: newsletterSubscriberRoutes,
  // },
  // {
  //   path: '/support',
  //   route: supportRoutes,
  // },
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
  
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
