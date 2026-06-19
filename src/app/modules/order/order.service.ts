import mongoose, { Types } from "mongoose";
import { IJwtPayload } from "../auth/auth.interface";
import { Coupon } from "../coupon/coupon.model";
import { IOrder } from "./order.interface";
import { Order } from "./order.model";
import { Product } from "../product/product.model";
import { Payment } from "../payment/payment.model";
import { generateTransactionId } from "../payment/payment.utils";
import { sslService } from "../sslcommerz/sslcommerz.service";
import { generateOrderInvoicePDF } from "../../utils/generateOrderInvoicePDF";
import { EmailHelper } from "../../utils/emailHelper";
import User from "../user/user.model";
import AppError from "../../errors/appError";
import { StatusCodes } from "http-status-codes";
import Shop from "../shop/shop.model";
import QueryBuilder from "../../builder/QueryBuilder";

const createOrder = async (
  orderData: Partial<IOrder>,
  authUser: IJwtPayload
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (orderData.products) {
      for (const productItem of orderData.products) {
        const product = await Product.findById(productItem.product)
          .populate("shop")
          .session(session);

        if (product) {
          if (product.isActive === false) {
            throw new Error(`Product ${product?.name} is inactive.`);
          }

          if (product.stock < productItem.quantity) {
            throw new Error(`Insufficient stock for product: ${product.name}`);
          }
          // Decrement the product stock
          product.stock -= productItem.quantity;
          await product.save({ session });
        } else {
          throw new Error(`Product not found: ${productItem.product}`);
        }
      }
    }

    // Handle coupon and update orderData
    if (orderData.coupon) {
      const coupon = await Coupon.findOne({ code: orderData.coupon }).session(
        session
      );
      if (coupon) {
        const currentDate = new Date();

        // Check if the coupon is within the valid date range
        if (currentDate < coupon.startDate) {
          throw new Error(`Coupon ${coupon.code} has not started yet.`);
        }

        if (currentDate > coupon.endDate) {
          throw new Error(`Coupon ${coupon.code} has expired.`);
        }

        orderData.coupon = coupon._id as Types.ObjectId;
        await Coupon.findByIdAndUpdate(
           coupon._id,
           { $inc: { usageCount: 1 } },
           { session }
        );
      } else {
        throw new Error("Invalid coupon code.");
      }
    }

    // Create the order
    const order = new Order({
      ...orderData,
      user: authUser.userId,
    });

    const createdOrder = await order.save({ session });
    await createdOrder.populate("user products.product");

    const transactionId = generateTransactionId();

    const payment = new Payment({
      user: authUser.userId,
      shop: createdOrder.shop,
      order: createdOrder._id,
      method: orderData.paymentMethod,
      transactionId,
      amount: createdOrder.finalAmount,
    });

    await payment.save({ session });

    let result;

    if (createdOrder.paymentMethod == "Online") {
      result = await sslService.initPayment({
        total_amount: createdOrder.finalAmount,
        tran_id: transactionId,
      });
      result = { paymentUrl: result };
    } else {
      result = order;
    }

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    try {
      const pdfBuffer = await generateOrderInvoicePDF(createdOrder);
      const emailContent = await EmailHelper.createEmailContent(
        {
          userName: (createdOrder.user as any).name || "Customer",
          orderId: (createdOrder._id as any).toString(),
          orderDate: new Date(createdOrder.createdAt as any).toLocaleDateString(),
          products: createdOrder.products,
          totalAmount: createdOrder.totalAmount,
          discount: createdOrder.discount,
          deliveryCharge: createdOrder.deliveryCharge,
          finalAmount: createdOrder.finalAmount,
          shippingAddress: createdOrder.shippingAddress
        },
        "orderConfirmation"
      );

      const attachment = {
        filename: `Invoice_${(createdOrder._id as any)}.pdf`,
        content: pdfBuffer,
        encoding: "base64",
      };

      if (emailContent) {
        await EmailHelper.sendEmail(
          (createdOrder.user as any).email,
          emailContent,
          "Order confirmed!",
          attachment
        );
      }
    } catch (emailErr) {
      console.error("Failed to send order confirmation email:", emailErr);
    }
    return result;
  } catch (error) {
    console.log(error);
    // Rollback the transaction in case of error
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getMyShopOrders = async (
  query: Record<string, unknown>,
  authUser: IJwtPayload
) => {
  const userHasShop = await User.findById(authUser.userId).select(
    "isActive hasShop"
  );

  if (!userHasShop)
    throw new AppError(StatusCodes.NOT_FOUND, "User not found!");
  if (!userHasShop.isActive)
    throw new AppError(StatusCodes.BAD_REQUEST, "User account is not active!");
  if (!userHasShop.hasShop)
    throw new AppError(StatusCodes.BAD_REQUEST, "User does not have any shop!");

  const shopIsActive = await Shop.findOne({
    user: userHasShop._id,
    isActive: true,
  }).select("isActive");

  if (!shopIsActive)
    throw new AppError(StatusCodes.BAD_REQUEST, "Shop is not active!");

  const orderQuery = new QueryBuilder(
    Order.find({ shop: shopIsActive._id }).populate(
      "user products.product coupon"
    ),
    query
  )
    .search(["user.name", "user.email", "products.product.name"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await orderQuery.modelQuery;

  const meta = await orderQuery.countTotal();

  return {
    meta,
    result,
  };
};

const getOrderDetails = async (orderId: string) => {
  const order = await Order.findById(orderId).populate(
    "user products.product coupon"
  );
  if (!order) {
    throw new AppError(StatusCodes.NOT_FOUND, "Order not Found");
  }

  order.payment = await Payment.findOne({ order: order._id });
  return order;
};

const getMyOrders = async (
  query: Record<string, unknown>,
  authUser: IJwtPayload
) => {
  const { status, sort, ...remainingQuery } = query;
  const filter: Record<string, any> = { user: authUser.userId };

  if (status) {
     let mappedStatus = status as string;
     if (mappedStatus.toLowerCase() === 'delivered') mappedStatus = 'Completed';
     mappedStatus = mappedStatus.charAt(0).toUpperCase() + mappedStatus.slice(1).toLowerCase();
     filter.status = mappedStatus;
  }

  let sortOption = '-createdAt';
  if (sort === 'newest') {
     sortOption = '-createdAt';
  } else if (sort === 'oldest') {
     sortOption = 'createdAt';
  }

  const orderQuery = new QueryBuilder(
    Order.find(filter).populate("user products.product coupon"),
    remainingQuery
  )
    .sort()
    .paginate();

  orderQuery.modelQuery = orderQuery.modelQuery.sort(sortOption);

  const result = await orderQuery.modelQuery;
  const meta = await orderQuery.countTotal();

  return {
    meta,
    result,
  };
};

const changeOrderStatus = async (
  orderId: string,
  newStatus: string,
  authUser: IJwtPayload
) => {
  let targetStatus = newStatus;
  if (targetStatus.toLowerCase() === 'delivered') targetStatus = 'Completed';
  targetStatus = targetStatus.charAt(0).toUpperCase() + targetStatus.slice(1).toLowerCase();

  if (!['Pending', 'Processing', 'Completed', 'Cancelled'].includes(targetStatus)) {
     throw new AppError(StatusCodes.BAD_REQUEST, `Invalid status value: ${newStatus}`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
     const order = await Order.findById(orderId).session(session);
     if (!order) {
        throw new AppError(StatusCodes.NOT_FOUND, 'Order not found');
     }

     const currentStatus = order.status;

     if (currentStatus !== targetStatus) {
        let isValidTransition = false;
        if (currentStatus === 'Pending') {
           isValidTransition = (targetStatus === 'Processing' || targetStatus === 'Cancelled');
        } else if (currentStatus === 'Processing') {
           isValidTransition = (targetStatus === 'Completed');
        }

        if (!isValidTransition) {
           throw new AppError(StatusCodes.BAD_REQUEST, `Invalid status transition from ${currentStatus} to ${targetStatus}`);
        }
     }

     order.status = targetStatus as 'Pending' | 'Processing' | 'Completed' | 'Cancelled';

     if (targetStatus === 'Cancelled' && currentStatus !== 'Cancelled') {
        for (const item of order.products) {
           await Product.findByIdAndUpdate(
              item.product,
              { $inc: { stock: item.quantity } },
              { session }
           );
        }
     }

     const updatedOrder = await order.save({ session });
     await updatedOrder.populate('user products.product');

     await session.commitTransaction();
     session.endSession();

      if (targetStatus === 'Completed' && currentStatus !== 'Completed') {
         try {
            const emailContent = await EmailHelper.createEmailContent(
               {
                  userName: (updatedOrder.user as any).name || 'Customer',
                  orderId: (updatedOrder._id as any).toString(),
                  totalAmount: updatedOrder.finalAmount
               },
              'orderDelivered'
           );
           await EmailHelper.sendEmail(
              (updatedOrder.user as any).email,
              emailContent,
              'Your order has been delivered!'
           );
        } catch (emailError) {
           console.error('Failed to send delivery email:', emailError);
        }
     }

     return updatedOrder;
  } catch (error) {
     await session.abortTransaction();
     session.endSession();
     throw error;
  }
};

const getAllOrders = async (query: Record<string, unknown>) => {
   const { status, search, page, limit } = query;
   const filter: Record<string, any> = {};

   if (status) {
      let mappedStatus = status as string;
      if (mappedStatus.toLowerCase() === 'delivered') mappedStatus = 'Completed';
      mappedStatus = mappedStatus.charAt(0).toUpperCase() + mappedStatus.slice(1).toLowerCase();
      filter.status = mappedStatus;
   }

   if (search) {
      if (mongoose.Types.ObjectId.isValid(search as string)) {
         filter._id = new mongoose.Types.ObjectId(search as string);
      } else {
         const matchingUsers = await User.find({ email: { $regex: search as string, $options: 'i' } }).select('_id');
         const userIds = matchingUsers.map(u => u._id);
         filter.user = { $in: userIds };
      }
   }

   const orderQuery = new QueryBuilder(
      Order.find(filter).populate('user products.product coupon'),
      query
   )
      .sort()
      .paginate();

   const result = await orderQuery.modelQuery;
   const meta = await orderQuery.countTotal();

   return {
      meta,
      result
   };
};

export const OrderService = {
  createOrder,
  getMyShopOrders,
  getOrderDetails,
  getMyOrders,
  changeOrderStatus,
  getAllOrders,
};
