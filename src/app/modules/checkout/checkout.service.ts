import prisma from '../../utils/prisma';
import { CheckoutStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

// Create checkout for a user
const createCheckoutIntoDb = async (
  userId: string,
  data: { all?: boolean; productIds?: string[] },
) => {
  if (!userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  // check the products are own or not if own then throw error
  const userProducts = await prisma.product.findMany({
    where: { isVisible: true, seller: { userId: userId } },
    select: { id: true },
  });
  const userProductIds = new Set(userProducts.map(prod => prod.id));

  // If specific productIds provided, validate those
  if (data.productIds && data.productIds.length > 0) {
    for (const pid of data.productIds) {
      if (userProductIds.has(pid)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Cannot add your own product to cart: ${pid}`,
        );
      }
    }
  } else if (data.all) {
    // If 'all' was requested, fetch the cart and validate its items
    const cartForCheck = await prisma.cart.findFirst({
      where: { userId },
      include: { items: { select: { productId: true } } },
    });
    const cartItemProductIds = cartForCheck?.items.map(i => i.productId) ?? [];
    for (const pid of cartItemProductIds) {
      if (userProductIds.has(pid)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Cannot add your own product to cart: ${pid}`,
        );
      }
    }
  }

  return await prisma.$transaction(async tx => {
    // delete existing checkout and items if any
    await tx.checkoutItem.deleteMany({
      where: { checkout: { userId } },
    });
    await tx.checkout.deleteMany({
      where: { userId },
    });

    // 1. Get user's cart and items
    const cart = await tx.cart.findFirst({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Cart is empty');
    }

    // 2. Decide which items to checkout
    let selectedItems;
    if (data.all) {
      selectedItems = cart.items;
    } else if (data.productIds && data.productIds.length > 0) {
      selectedItems = cart.items.filter(item =>
        data.productIds?.includes(item.productId),
      );
    } else {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Provide either all=true or specific productIds',
      );
    }

    if (selectedItems.length === 0) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'No valid cart items selected',
      );
    }

    // 3. Validate stock for each item and calculate total amount with discount
    let totalAmount = 0;
    for (const item of selectedItems as any[]) {
      const qty = item.quantity ?? 1;
      if (qty < 1) {
        throw new AppError(httpStatus.BAD_REQUEST, 'Invalid quantity in cart');
      }
      if (qty > item.product.stock) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Insufficient stock for product ${item.productId}`,
        );
      }
      // Calculate discounted price
      const originalPrice = item.product.price || 0;
      const discountPercent = item.product.discount || 0;
      const discountedPrice =
        originalPrice - (originalPrice * discountPercent) / 100;
      totalAmount += discountedPrice * qty;
    }

    // 4. Create checkout record
    const checkout = await tx.checkout.create({
      data: {
        userId,
        totalAmount,
        status: CheckoutStatus.PENDING,
      },
    });

    // 5. Create checkout items
    await tx.checkoutItem.createMany({
      data: selectedItems.map((item: any) => ({
        checkoutId: checkout.id,
        productId: item.productId,
        quantity: item.quantity,
      })),
    });

    // 6. Remove purchased items from cart
    // await tx.cartItem.deleteMany({
    //   where: {
    //     id: { in: selectedItems.map(item => item.id) },
    //   },
    // });

    // 7. Return the checkout with items and product details
    return await tx.checkout.findUnique({
      where: { id: checkout.id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                productName: true,
                price: true,
                discount: true,
              },
            },
          },
        },
      },
    });
  });
};

// Mark checkout as PAID
const markCheckoutPaid = async (
  userId: string,
  checkoutId: string,
  paymentId?: string,
) => {
  // Fetch checkout and its items
  const checkout = await prisma.checkout.findUnique({
    where: { id: checkoutId },
    include: {
      items: { include: { product: true, shippingOption: true } },
      user: true,
    },
  });

  if (!checkout) throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');
  // validate ownership
  if (checkout.userId !== userId) {
    throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');
  }
  // validate status
  if (checkout.status === CheckoutStatus.PAID) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout already paid');
  }
  if (checkout.status !== CheckoutStatus.PENDING) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Checkout is not in a payable state',
    );
  }

  // Sanity check: must have items
  if (!checkout.items || checkout.items.length === 0) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout has no items');
  }

  // VALIDATE: All items must have shipping selected
  const itemsWithoutShipping = checkout.items.filter(
    item => !item.shippingOptionId || !item.shippingCost,
  );
  if (itemsWithoutShipping.length > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'All items must have shipping selected before payment. Please update shipping options.',
    );
  }

  const shippingAddress = await prisma.address.findFirst({
    where: {
      userId: userId,
      type: 'SHIPPING',
    },
  });

  if (!shippingAddress) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Shipping address not found for checkout',
    );
  }
  let billingAddress = await prisma.address.findFirst({
    where: {
      userId: userId,
      type: 'BILLING',
    },
  });

  if (!billingAddress) {
    billingAddress = shippingAddress;
  }

  // Group items by seller for multi-vendor order creation
  const itemsBySeller = checkout.items.reduce((acc, item) => {
    const sellerId = item.product.sellerId;
    if (!acc[sellerId]) {
      acc[sellerId] = [];
    }
    acc[sellerId].push(item);
    return acc;
  }, {} as Record<string, typeof checkout.items>);

  return await prisma.$transaction(async tx => {
    const createdOrders = [];

    // Create separate order for each seller
    for (const [sellerId, sellerItems] of Object.entries(itemsBySeller)) {
      // Calculate seller order total and prepare order items
      let sellerTotal = 0;
      let totalProductAmount = 0;
      let totalShippingAmount = 0;
      const orderItems = [];
      const productDetails: string[] = [];
      const shippingDetails: string[] = [];

      for (const item of sellerItems as any[]) {
        const price = item.product?.price ?? 0;
        const discount = item.product?.discount ?? 0;
        const effectivePrice =
          typeof discount === 'number' && discount > 0 && discount < 100
            ? Number((price * (1 - discount / 100)).toFixed(2))
            : price;

        const itemSubtotal = effectivePrice * item.quantity;
        const itemShipping = item.shippingCost || 0;
        
        totalProductAmount += itemSubtotal;
        totalShippingAmount += itemShipping;
        sellerTotal += itemSubtotal + itemShipping;

        orderItems.push({
          productId: item.productId,
          quantity: item.quantity,
          price: effectivePrice,
        });

        // Detailed product line: "Product Name x2 @ $50.00 = $100.00"
        productDetails.push(
          `${item.product.productName} x${item.quantity} @ DZD${effectivePrice.toFixed(2)} = DZD${itemSubtotal.toFixed(2)}`
        );

        // Detailed shipping line: "Product Name: DHL $15.00 (3-5 days)"
        shippingDetails.push(
          `${item.product.productName}: ${item.shippingCarrier || 'N/A'} DZD${itemShipping.toFixed(2)} (${item.estimatedDelivery || 'N/A'})`
        );
      }

      // Prepare invoice data for this seller
      const sellerUser = await tx.user.findUnique({
        where: { id: sellerId },
        include: {
          sellerProfile: true,
        },
      });

      // BUYER RECEIPT - Full purchase details
      const buyerInvoice = {
        'Invoice Type': 'Purchase Receipt',
        'Invoice Number': paymentId || 'Cash Payment',
        'Invoice Date': new Date().toLocaleDateString(),
        'Order ID': '', // Will be set after order creation
        
        // Seller Info (who they bought from)
        Seller: sellerUser?.sellerProfile?.companyName || 'Unknown',
        'Seller Email': sellerUser?.email || '',
        'Seller Contact': sellerUser?.sellerProfile?.contactInfo  || '',
        
        // Buyer Info
        Buyer: checkout.user.fullName,
        'Buyer Email': checkout.user.email,
        'Buyer Contact': checkout.user.phoneNumber || '',
        
        // Product Details
        'Product Details': productDetails.join(' | '),
        'Product IDs': sellerItems.map((item: any) => item.productId).join(', '),
        'Subtotal (Products)(DZD)': `${totalProductAmount.toFixed(2)}`,
        
        // Shipping Details
        'Shipping Details': shippingDetails.join(' | '),
        'Total Shipping(DZD)': `${totalShippingAmount.toFixed(2)}`,
        
        // Totals
        'Total Amount(DZD)': `${sellerTotal.toFixed(2)}`,
        'Payment Method': paymentId ? 'Online Payment' : 'Cash on Delivery',
        'Payment Status': paymentId ? 'Paid' : 'Cash on Delivery',
        
        // Addresses
        'Shipping Address': `${shippingAddress.addressLine}, ${shippingAddress.city}, ${
          shippingAddress.state || ''
        } ${shippingAddress.postalCode || ''}, ${shippingAddress.country || ''}`,
        'Billing Address': `${billingAddress.addressLine}, ${billingAddress.city}, ${
          billingAddress.state || ''
        } ${billingAddress.postalCode || ''}, ${billingAddress.country || ''}`,
      };

      // SELLER FULFILLMENT DOCUMENT - Only what seller needs
      const sellerInvoice = {
        'Document Type': 'Fulfillment Order',
        'Invoice Number': paymentId || 'Cash Payment',
        'Order Date': new Date().toLocaleDateString(),
        'Order ID': '', // Will be set after order creation
        
        // Shipping Recipient Info (where to send)
        'Ship To Name': shippingAddress.name || checkout.user.fullName,
        'Ship To Phone': shippingAddress.phoneNumber || checkout.user.phoneNumber || '',
        'Ship To Address': `${shippingAddress.addressLine}, ${
          shippingAddress.apartmentNo ? `Apt ${shippingAddress.apartmentNo}, ` : ''
        }${shippingAddress.city}, ${shippingAddress.state || ''} ${
          shippingAddress.postalCode || ''
        }, ${shippingAddress.country || ''}`,
        
        // Products to Ship
        'Items to Ship': productDetails.join(' | '),
        'Product IDs': sellerItems.map((item: any) => item.productId).join(', '),
        
        // Shipping Instructions
        'Shipping Method': shippingDetails.join(' | '),
        
        // Financial Summary (what seller earns)
        'Product Revenue(DZD)': `${totalProductAmount.toFixed(2)}`,
        'Shipping Revenue(DZD)': `${totalShippingAmount.toFixed(2)}`,
        'Total Revenue(DZD)': `${sellerTotal.toFixed(2)}`,
        'Payment Status': paymentId ? 'Paid' : 'COD - Collect on Delivery',
        
      };

      // Create order for this seller
      const order = await tx.order.create({
        data: {
          userId: checkout.userId,
          sellerId: sellerId,
          paymentId: paymentId || null,
          paymentStatus: paymentId
            ? PaymentStatus.COMPLETED
            : PaymentStatus.CASH,
          invoice: buyerInvoice,
          sellerInvoice: sellerInvoice,
          totalAmount: sellerTotal,
          shippingId: shippingAddress.id,
          billingId: billingAddress.id,
          status: OrderStatus.PENDING,
          shippingSnapshot: shippingAddress,
          billingSnapshot: billingAddress,
        },
      });

      // Update invoices with order ID
      await tx.order.update({
        where: { id: order.id },
        data: {
          invoice: { ...buyerInvoice, 'Order ID': order.id },
          sellerInvoice: { ...sellerInvoice, 'Order ID': order.id },
        },
      });

      // Create order items in bulk
      await tx.orderItem.createMany({
        data: orderItems.map(item => ({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
      });

      // Update product stock and total sold for all items
      for (const item of orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            totalSold: { increment: item.quantity },
            stock: { decrement: item.quantity },
          },
        });
      }

      createdOrders.push(order);
    }

    // Delete the checkout
    await tx.checkoutItem.deleteMany({
      where: { checkoutId: checkoutId },
    });
    await tx.checkout.delete({
      where: { id: checkoutId },
    });

    // Clear cart items that were paid for
    const cartItems = await prisma.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    await tx.cartItem.deleteMany({
      where: {
        cartId: cartItems?.id,
        productId: { in: checkout.items.map(item => item.productId) },
      },
    });

    return { 
      success: true, 
      type: 'multi-vendor', 
      checkoutId,
      ordersCreated: createdOrders.length,
      orders: createdOrders,
    };
  });
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
) => {
  // Validate checkout ownership and status
  const checkout = await prisma.checkout.findFirst({
    where: { id: checkoutId, userId, status: CheckoutStatus.PENDING },
    include: { items: { include: { product: true } } },
  });

  if (!checkout) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Checkout not found or already completed',
    );
  }

  // Validate all checkout items have shipping selections
  const checkoutItemIds = checkout.items.map(item => item.id);
  const selectionItemIds = data.shippingSelections.map(s => s.checkoutItemId);

  const missingSelections = checkoutItemIds.filter(
    id => !selectionItemIds.includes(id),
  );
  if (missingSelections.length > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'All checkout items must have shipping selections',
    );
  }

  return await prisma.$transaction(async tx => {
    let totalShippingCost = 0;

    // Update each checkout item with shipping info
    for (const selection of data.shippingSelections) {
      const checkoutItem = checkout.items.find(
        item => item.id === selection.checkoutItemId,
      );

      if (!checkoutItem) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Invalid checkout item: ${selection.checkoutItemId}`,
        );
      }

      // Validate shipping option belongs to this product
      const shippingOption = await tx.productShipping.findFirst({
        where: {
          id: selection.shippingOptionId,
          productId: checkoutItem.productId,
        },
      });

      if (!shippingOption) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Invalid shipping option for product ${checkoutItem.product.productName}`,
        );
      }

      // Update checkout item with shipping details
      await tx.checkoutItem.update({
        where: { id: checkoutItem.id },
        data: {
          shippingOptionId: shippingOption.id,
          shippingCost: shippingOption.cost,
          shippingCarrier: shippingOption.carrier,
          shippingCountry: shippingOption.countryName,
          estimatedDelivery: `${shippingOption.deliveryMin}-${shippingOption.deliveryMax} days`,
        },
      });

      totalShippingCost += shippingOption.cost;
    }

    // Recalculate total amount (product cost + shipping)
    const productTotal = checkout.items.reduce((sum, item) => {
      const price = item.product.price || 0;
      const discount = item.product.discount || 0;
      const discountedPrice = price - (price * discount) / 100;
      return sum + discountedPrice * item.quantity;
    }, 0);

    const newTotalAmount = productTotal + totalShippingCost;

    // Update checkout total
    const updatedCheckout = await tx.checkout.update({
      where: { id: checkoutId },
      data: { totalAmount: newTotalAmount },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                productName: true,
                price: true,
                discount: true,
                sellerId: true,
              },
            },
            shippingOption: true,
          },
        },
      },
    });

    return updatedCheckout;
  });
};

// Get all checkouts for a user
const getCheckoutListFromDb = async (userId: string) => {
  const checkouts = await prisma.checkout.findMany({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              brandId: true,
              sellerId: true,
              categoryId: true,
              productImages: true,
              productName: true,
              price: true,
              discount: true,
              shippings: {
                select: {
                  id: true,
                  cost: true,
                  countryCode: true,
                  countryName: true,
                  carrier: true,
                  deliveryMin: true,
                  deliveryMax: true,
                },
              },
            },
          },
          shippingOption: true,
        },
      },
    },
  });

  // Calculate afterDiscount price for each product
  const checkoutsWithDiscount = checkouts.map(checkout => ({
    ...checkout,
    items: checkout.items.map(item => ({
      ...item,
      product: {
        ...item.product,
        afterDiscount: item.product.discount
          ? item.product.price - (item.product.price * item.product.discount) / 100
          : item.product.price,
      },
    })),
  }));

  const checkoutAfterDiscount = checkoutsWithDiscount;

  if (!checkoutAfterDiscount || checkoutAfterDiscount.length === 0) {
    return { message: 'No checkouts found' };
  }

  return checkoutAfterDiscount;
};

// Get checkout by ID
const getCheckoutByIdFromDb = async (userId: string, checkoutId: string) => {
  const checkout = await prisma.checkout.findUnique({
    where: { id: checkoutId },
    include: { items: { include: { product: true } } },
  });

  if (!checkout) throw new AppError(httpStatus.NOT_FOUND, 'Checkout not found');

  return checkout;
};

// Update checkout
const updateCheckoutIntoDb = async (
  userId: string,
  checkoutId: string,
  data: Partial<{ status: CheckoutStatus; totalAmount: number }>,
) => {
  const updatedCheckout = await prisma.checkout.update({
    where: { id: checkoutId },
    data,
  });

  if (!updatedCheckout) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout not updated');
  }

  return updatedCheckout;
};

// Delete checkout
const deleteCheckoutFromDb = async (userId: string, checkoutId: string) => {
  const deletedCheckout = await prisma.checkout.delete({
    where: { id: checkoutId },
  });

  if (!deletedCheckout) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Checkout not deleted');
  }

  return { success: true, checkoutId };
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
