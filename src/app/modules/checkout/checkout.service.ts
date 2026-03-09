import prisma from '../../utils/prisma';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

// Create checkout for a user
const createCheckoutIntoDb = async (
  userId: string,
  data: { all?: boolean; productIds?: string[] },
) => {
  // if (!userId) {
  //   throw new AppError(httpStatus.BAD_REQUEST, 'User ID is required');
  // }

  // if (!data.all && (!data.productIds || data.productIds.length === 0)) {
  //   throw new AppError(
  //     httpStatus.BAD_REQUEST,
  //     'Provide either all=true or specific productIds',
  //   );
  // }

  // return await prisma.$transaction(async (tx) => {
  //   // 1️⃣ Fetch cart with items + product + seller
  //   const cart = await tx.cart.findFirst({
  //     where: { userId },
  //     include: {
  //       items: {
  //         include: {
  //           product: {
  //             include: {
  //               seller: {
  //                 select: { userId: true },
  //               },
  //             },
  //           },
  //         },
  //       },
  //     },
  //   });

  //   if (!cart || cart.items.length === 0) {
  //     throw new AppError(httpStatus.BAD_REQUEST, 'Cart is empty');
  //   }

  //   // 2️⃣ Select checkout items
  //   const selectedItems = data.all
  //     ? cart.items
  //     : cart.items.filter((item) =>
  //         data.productIds?.includes(item.productId),
  //       );

  //   if (selectedItems.length === 0) {
  //     throw new AppError(
  //       httpStatus.BAD_REQUEST,
  //       'No valid cart items selected',
  //     );
  //   }

  //   let totalAmount = 0;

  //   for (const item of selectedItems) {
  //     const qty = item.quantity ?? 1;

  //     if (qty < 1) {
  //       throw new AppError(httpStatus.BAD_REQUEST, 'Invalid quantity');
  //     }

  //     // 3️⃣ Prevent buying own product
  //     if (item.product.seller.userId === userId) {
  //       throw new AppError(
  //         httpStatus.BAD_REQUEST,
  //         `Cannot purchase your own product`,
  //       );
  //     }

  //     // 4️⃣ Stock validation
  //     if (qty > item.product.stock) {
  //       throw new AppError(
  //         httpStatus.BAD_REQUEST,
  //         `Insufficient stock for ${item.product.productName}`,
  //       );
  //     }

  //     const price = item.product.price || 0;
  //     const discount = item.product.discount || 0;
  //     const discountedPrice = price - (price * discount) / 100;

  //     totalAmount += discountedPrice * qty;
  //   }

  //   // 5️⃣ Remove old checkout (if exists)
  //   await tx.checkoutItem.deleteMany({
  //     where: { checkout: { userId } },
  //   });

  //   await tx.checkout.deleteMany({
  //     where: { userId },
  //   });

  //   // 6️⃣ Create checkout
  //   const checkout = await tx.checkout.create({
  //     data: {
  //       userId,
  //       totalAmount,
  //       status: CheckoutStatus.PENDING,
  //     },
  //   });

  //   // 7️⃣ Create checkout items
  //   await tx.checkoutItem.createMany({
  //     data: selectedItems.map((item) => ({
  //       checkoutId: checkout.id,
  //       productId: item.productId,
  //       quantity: item.quantity,
  //       priceSnapshot: item.product.price, // IMPORTANT (see below)
  //     })),
  //   });

  //   return tx.checkout.findUnique({
  //     where: { id: checkout.id },
  //     include: {
  //       items: {
  //         include: {
  //           product: {
  //             select: {
  //               id: true,
  //               productName: true,
  //               price: true,
  //               discount: true,
  //             },
  //           },
  //         },
  //       },
  //     },
  //   });
  // });
};


// Mark checkout as PAID
const markCheckoutPaid = async (
  userId: string,
  checkoutId: string,
  paymentId?: string,
) => {
  // // 1️⃣ Fetch checkout with items and user
  // const checkout = await prisma.checkout.findUnique({
  //   where: { id: checkoutId },
  //   include: {
  //     items: { include: { product: true, shippingOption: true } },
  //     user: true,
  //   },
  // });

  // if (!checkout) throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');
  // if (checkout.userId !== userId) throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');
  // if (checkout.status === CheckoutStatus.PAID) throw new AppError(httpStatus.BAD_REQUEST, 'Checkout already paid');
  // if (checkout.status !== CheckoutStatus.PENDING) throw new AppError(httpStatus.BAD_REQUEST, 'Checkout is not in a payable state');
  // if (!checkout.items || checkout.items.length === 0) throw new AppError(httpStatus.BAD_REQUEST, 'Checkout has no items');

  // // 2️⃣ Validate shipping for all items
  // const itemsWithoutShipping = checkout.items.filter(
  //   item => !item.shippingOptionId || !item.shippingCost,
  // );
  // if (itemsWithoutShipping.length > 0) {
  //   throw new AppError(
  //     httpStatus.BAD_REQUEST,
  //     'All items must have shipping selected before payment. Please update shipping options.',
  //   );
  // }

  // // 3️⃣ Fetch addresses
  // const shippingAddress = await prisma.address.findFirst({ where: { userId, type: 'SHIPPING' } });
  // if (!shippingAddress) throw new AppError(httpStatus.BAD_REQUEST, 'Shipping address not found for checkout');

  // let billingAddress = await prisma.address.findFirst({ where: { userId, type: 'BILLING' } });
  // if (!billingAddress) billingAddress = shippingAddress;

  // // 4️⃣ Group items by seller
  // const itemsBySeller = checkout.items.reduce((acc, item) => {
  //   const sellerId = item.product.sellerId;
  //   if (!acc[sellerId]) acc[sellerId] = [];
  //   acc[sellerId].push(item);
  //   return acc;
  // }, {} as Record<string, typeof checkout.items>);

  // // 5️⃣ Transaction
  // return await prisma.$transaction(async tx => {
  //   const createdOrders: any[] = [];

  //   for (const [sellerId, sellerItems] of Object.entries(itemsBySeller)) {
  //     let sellerTotal = 0;
  //     let totalProductAmount = 0;
  //     let totalShippingAmount = 0;
  //     const orderItems: any[] = [];
  //     const productDetails: string[] = [];
  //     const shippingDetails: string[] = [];

  //     for (const item of sellerItems as any[]) {
  //       const price = item.product.price ?? 0;
  //       const discount = item.product.discount ?? 0;
  //       const effectivePrice = discount > 0 && discount < 100 ? Number((price * (1 - discount / 100)).toFixed(2)) : price;

  //       const subtotal = effectivePrice * item.quantity;
  //       const shippingCost = item.shippingCost ?? 0;

  //       totalProductAmount += subtotal;
  //       totalShippingAmount += shippingCost;
  //       sellerTotal += subtotal + shippingCost;

  //       orderItems.push({
  //         productId: item.productId,
  //         quantity: item.quantity,
  //         price: effectivePrice,
  //       });

  //       productDetails.push(`${item.product.productName} x${item.quantity} @ DZD${effectivePrice.toFixed(2)} = DZD${subtotal.toFixed(2)}`);
  //       shippingDetails.push(`${item.product.productName}: ${item.shippingCarrier || 'N/A'} DZD${shippingCost.toFixed(2)} (${item.estimatedDelivery || 'N/A'})`);
  //     }

  //     // Seller info
  //     const sellerUser = await tx.user.findUnique({ where: { id: sellerId }, include: { sellerProfile: true } });

  //     // Buyer invoice
  //     const buyerInvoice = {
  //       'Invoice Type': 'Purchase Receipt',
  //       'Invoice Number': paymentId || 'Cash Payment',
  //       'Invoice Date': new Date().toLocaleDateString(),
  //       'Order ID': '',
  //       Seller: sellerUser?.sellerProfile?.companyName || 'Unknown',
  //       'Seller Email': sellerUser?.email || '',
  //       'Seller Contact': sellerUser?.sellerProfile?.contactInfo || '',
  //       Buyer: checkout.user.fullName,
  //       'Buyer Email': checkout.user.email,
  //       'Buyer Contact': checkout.user.phoneNumber || '',
  //       'Product Details': productDetails.join(' | '),
  //       'Product IDs': sellerItems.map(i => i.productId).join(', '),
  //       'Subtotal (Products)(DZD)': totalProductAmount.toFixed(2),
  //       'Shipping Details': shippingDetails.join(' | '),
  //       'Total Shipping(DZD)': totalShippingAmount.toFixed(2),
  //       'Total Amount(DZD)': sellerTotal.toFixed(2),
  //       'Payment Method': paymentId ? 'Online Payment' : 'Cash on Delivery',
  //       'Payment Status': paymentId ? 'Paid' : 'Cash on Delivery',
  //       'Shipping Address': `${shippingAddress.addressLine}, ${shippingAddress.city}, ${shippingAddress.state || ''} ${shippingAddress.postalCode || ''}, ${shippingAddress.country || ''}`,
  //       'Billing Address': `${billingAddress.addressLine}, ${billingAddress.city}, ${billingAddress.state || ''} ${billingAddress.postalCode || ''}, ${billingAddress.country || ''}`,
  //     };

  //     // Seller invoice
  //     const sellerInvoice = {
  //       'Document Type': 'Fulfillment Order',
  //       'Invoice Number': paymentId || 'Cash Payment',
  //       'Order Date': new Date().toLocaleDateString(),
  //       'Order ID': '',
  //       'Ship To Name': shippingAddress.name || checkout.user.fullName,
  //       'Ship To Phone': shippingAddress.phoneNumber || checkout.user.phoneNumber || '',
  //       'Ship To Address': `${shippingAddress.addressLine}, ${shippingAddress.apartmentNo ? `Apt ${shippingAddress.apartmentNo}, ` : ''}${shippingAddress.city}, ${shippingAddress.state || ''} ${shippingAddress.postalCode || ''}, ${shippingAddress.country || ''}`,
  //       'Items to Ship': productDetails.join(' | '),
  //       'Product IDs': sellerItems.map(i => i.productId).join(', '),
  //       'Shipping Method': shippingDetails.join(' | '),
  //       'Product Revenue(DZD)': totalProductAmount.toFixed(2),
  //       'Shipping Revenue(DZD)': totalShippingAmount.toFixed(2),
  //       'Total Revenue(DZD)': sellerTotal.toFixed(2),
  //       'Payment Status': paymentId ? 'Paid' : 'COD - Collect on Delivery',
  //     };

  //     // Create order
  //     const order = await tx.order.create({
  //       data: {
  //         userId: checkout.userId,
  //         sellerId,
  //         paymentId: paymentId || null,
  //         paymentStatus: paymentId ? PaymentStatus.COMPLETED : PaymentStatus.CASH,
  //         invoice: buyerInvoice,
  //         sellerInvoice: sellerInvoice,
  //         totalAmount: sellerTotal,
  //         shippingId: shippingAddress.id,
  //         billingId: billingAddress.id,
  //         status: OrderStatus.PENDING,
  //         shippingSnapshot: shippingAddress,
  //         billingSnapshot: billingAddress,
  //       },
  //     });

  //     // Update order invoices with order ID
  //     await tx.order.update({
  //       where: { id: order.id },
  //       data: {
  //         invoice: { ...buyerInvoice, 'Order ID': order.id },
  //         sellerInvoice: { ...sellerInvoice, 'Order ID': order.id },
  //       },
  //     });

  //     // Create order items
  //     await tx.orderItem.createMany({ data: orderItems.map(item => ({ ...item, orderId: order.id })) });

  //     // Update stock
  //     await Promise.all(orderItems.map(item => 
  //       tx.product.update({
  //         where: { id: item.productId },
  //         data: { stock: { decrement: item.quantity }, totalSold: { increment: item.quantity } },
  //       })
  //     ));

  //     createdOrders.push(order);
  //   }

  //   // Delete checkout and its items
  //   await tx.checkoutItem.deleteMany({ where: { checkoutId } });
  //   await tx.checkout.delete({ where: { id: checkoutId } });

  //   // Clear cart items that were purchased
  //   const productIdsPaid = checkout.items.map(item => item.productId);
  //   await tx.cartItem.deleteMany({ where: { cart: { userId }, productId: { in: productIdsPaid } } });

  //   return { 
  //     success: true, 
  //     type: 'multi-vendor', 
  //     checkoutId,
  //     ordersCreated: createdOrders.length,
  //     orders: createdOrders,
  //   };
  // });
};


// Update checkout with shipping selections
const updateCheckoutWithShipping = async (
  userId: string,
  checkoutId: string,
  data: {
    shippingSelections: Array<{
      checkoutItemId: string;
      shippingOptionId: string;
    }>;
  },
) => 
  
  {
  // // Validate checkout ownership and status
  // const checkout = await prisma.checkout.findFirst({
  //   where: { id: checkoutId, userId, status: CheckoutStatus.PENDING },
  //   include: { items: { include: { product: true } } },
  // });

  // if (!checkout) {
  //   throw new AppError(
  //     httpStatus.NOT_FOUND,
  //     'Checkout not found or already completed',
  //   );
  // }

  // // Validate all checkout items have shipping selections
  // const checkoutItemIds = checkout.items.map(item => item.id);
  // const selectionItemIds = data.shippingSelections.map(s => s.checkoutItemId);

  // const missingSelections = checkoutItemIds.filter(
  //   id => !selectionItemIds.includes(id),
  // );
  // if (missingSelections.length > 0) {
  //   throw new AppError(
  //     httpStatus.BAD_REQUEST,
  //     'All checkout items must have shipping selections',
  //   );
  // }

  // return await prisma.$transaction(async tx => {
  //   let totalShippingCost = 0;

  //   // Update each checkout item with shipping info
  //   for (const selection of data.shippingSelections) {
  //     const checkoutItem = checkout.items.find(
  //       item => item.id === selection.checkoutItemId,
  //     );

  //     if (!checkoutItem) {
  //       throw new AppError(
  //         httpStatus.BAD_REQUEST,
  //         `Invalid checkout item: ${selection.checkoutItemId}`,
  //       );
  //     }

  //     // Validate shipping option belongs to this product
  //     const shippingOption = await tx.productShipping.findFirst({
  //       where: {
  //         id: selection.shippingOptionId,
  //         productId: checkoutItem.productId,
  //       },
  //     });

  //     if (!shippingOption) {
  //       throw new AppError(
  //         httpStatus.BAD_REQUEST,
  //         `Invalid shipping option for product ${checkoutItem.product.productName}`,
  //       );
  //     }

  //     // Update checkout item with shipping details
  //     await tx.checkoutItem.update({
  //       where: { id: checkoutItem.id },
  //       data: {
  //         shippingOptionId: shippingOption.id,
  //         shippingCost: shippingOption.cost,
  //         shippingCarrier: shippingOption.carrier,
  //         shippingCountry: shippingOption.countryName,
  //         estimatedDelivery: `${shippingOption.deliveryMin}-${shippingOption.deliveryMax} days`,
  //       },
  //     });

  //     totalShippingCost += shippingOption.cost;
  //   }

  //   // Recalculate total amount (product cost + shipping)
  //   const productTotal = checkout.items.reduce((sum, item) => {
  //     const price = item.product.price || 0;
  //     const discount = item.product.discount || 0;
  //     const discountedPrice = price - (price * discount) / 100;
  //     return sum + discountedPrice * item.quantity;
  //   }, 0);

  //   const newTotalAmount = productTotal + totalShippingCost;

  //   // Update checkout total
  //   const updatedCheckout = await tx.checkout.update({
  //     where: { id: checkoutId },
  //     data: { totalAmount: newTotalAmount },
  //     include: {
  //       items: {
  //         include: {
  //           product: {
  //             select: {
  //               id: true,
  //               productName: true,
  //               price: true,
  //               discount: true,
  //               sellerId: true,
  //             },
  //           },
  //           shippingOption: true,
  //         },
  //       },
  //     },
  //   });

  //   return updatedCheckout;
  // });
};

// Get all checkouts for a user
const getCheckoutListFromDb = async (userId: string) => {
  // const checkouts = await prisma.checkout.findMany({
  //   where: { userId },
  //   include: {
  //     items: {
  //       include: {
  //         product: {
  //           select: {
  //             id: true,
  //             brandId: true,
  //             sellerId: true,
  //             categoryId: true,
  //             productImages: true,
  //             productName: true,
  //             price: true,
  //             discount: true,
  //             shippings: {
  //               select: {
  //                 id: true,
  //                 cost: true,
  //                 countryCode: true,
  //                 countryName: true,
  //                 carrier: true,
  //                 deliveryMin: true,
  //                 deliveryMax: true,
  //               },
  //             },
  //           },
  //         },
  //         shippingOption: true,
  //       },
  //     },
  //   },
  // });

  // // Calculate afterDiscount price for each product
  // const checkoutsWithDiscount = checkouts.map(checkout => ({
  //   ...checkout,
  //   items: checkout.items.map(item => ({
  //     ...item,
  //     product: {
  //       ...item.product,
  //       afterDiscount: item.product.discount
  //         ? item.product.price - (item.product.price * item.product.discount) / 100
  //         : item.product.price,
  //     },
  //   })),
  // }));

  // const checkoutAfterDiscount = checkoutsWithDiscount;

  // if (!checkoutAfterDiscount || checkoutAfterDiscount.length === 0) {
  //   return { message: 'No checkouts found' };
  // }

  // return checkoutAfterDiscount;
};

// Get checkout by ID
const getCheckoutByIdFromDb = async (userId: string, checkoutId: string) => {
  // const checkout = await prisma.checkout.findUnique({
  //   where: { id: checkoutId },
  //   include: { items: { include: { product: true } } },
  // });

  // if (!checkout) throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');

  // return checkout;
};

// Update checkout
const updateCheckoutIntoDb = async (
  userId: string,
  checkoutId: string,
  // data: Partial<{ status: CheckoutStatus; totalAmount: number }>,
) => {
  // const updatedCheckout = await prisma.checkout.update({
  //   where: { id: checkoutId },
  //   data,
  // });

  // if (!updatedCheckout) {
  //   throw new AppError(httpStatus.BAD_REQUEST, 'Checkout not updated');
  // }

  // return updatedCheckout;
};

// Delete checkout
const deleteCheckoutFromDb = async (userId: string, checkoutId: string) => {
  // const deletedCheckout = await prisma.checkout.delete({
  //   where: { id: checkoutId },
  // });

  // if (!deletedCheckout) {
  //   throw new AppError(httpStatus.BAD_REQUEST, 'Checkout not deleted');
  // }

  // return { success: true, checkoutId };
};

export const checkoutService = {
  createCheckoutIntoDb,
  markCheckoutPaid,
  getCheckoutListFromDb,
  getCheckoutByIdFromDb,
  updateCheckoutIntoDb,
  deleteCheckoutFromDb,
  updateCheckoutWithShipping,
};
