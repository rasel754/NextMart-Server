import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/appError';
import { Order } from '../order/order.model';
import { IJwtPayload } from '../auth/auth.interface';
import Shop from '../shop/shop.model';
import User from '../user/user.model';
import { Product } from '../product/product.model';
import { Payment } from '../payment/payment.model';
import mongoose from 'mongoose';

const getLast6Months = () => {
   const months: string[] = [];
   const date = new Date();
   for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      months.push(d.toLocaleString('en-US', { month: 'short', year: 'numeric' }));
   }
   return months;
};

const getAdminMeta = async () => {
   const totalRevenueAgg = await Order.aggregate([
      { $match: { paymentStatus: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$finalAmount' } } }
   ]);
   const totalRevenue = totalRevenueAgg[0]?.total || 0;

   const totalOrders = await Order.countDocuments();
   const totalUsers = await User.countDocuments({ role: 'user' });
   const totalShops = await Shop.countDocuments();
   const totalProducts = await Product.countDocuments();

   const sixMonthsAgo = new Date();
   sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
   sixMonthsAgo.setDate(1);
   sixMonthsAgo.setHours(0, 0, 0, 0);

   // 1. Monthly revenue
   const monthlyRevenueAgg = await Order.aggregate([
      {
         $match: {
            paymentStatus: 'Paid',
            createdAt: { $gte: sixMonthsAgo }
         }
      },
      {
         $group: {
            _id: {
               year: { $year: '$createdAt' },
               month: { $month: '$createdAt' }
            },
            revenue: { $sum: '$finalAmount' }
         }
      }
   ]);

   // 2. Monthly orders
   const monthlyOrdersAgg = await Order.aggregate([
      {
         $match: {
            createdAt: { $gte: sixMonthsAgo }
         }
      },
      {
         $group: {
            _id: {
               year: { $year: '$createdAt' },
               month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
         }
      }
   ]);

   // 3. New users per month
   const newUsersAgg = await User.aggregate([
      {
         $match: {
            role: 'user',
            createdAt: { $gte: sixMonthsAgo }
         }
      },
      {
         $group: {
            _id: {
               year: { $year: '$createdAt' },
               month: { $month: '$createdAt' }
            },
            count: { $sum: 1 }
         }
      }
   ]);

   // Helper arrays formatting
   const monthsList = getLast6Months();
   
   const revenueMap = new Map<string, number>();
   monthlyRevenueAgg.forEach(item => {
      const monthStr = new Date(item._id.year, item._id.month - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
      revenueMap.set(monthStr, item.revenue);
   });
   const monthlyRevenue = monthsList.map(month => ({
      month,
      revenue: revenueMap.get(month) || 0
   }));

   const ordersMap = new Map<string, number>();
   monthlyOrdersAgg.forEach(item => {
      const monthStr = new Date(item._id.year, item._id.month - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
      ordersMap.set(monthStr, item.count);
   });
   const monthlyOrders = monthsList.map(month => ({
      month,
      count: ordersMap.get(month) || 0
   }));

   const usersMap = new Map<string, number>();
   newUsersAgg.forEach(item => {
      const monthStr = new Date(item._id.year, item._id.month - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
      usersMap.set(monthStr, item.count);
   });
   const newUsersPerMonth = monthsList.map(month => ({
      month,
      count: usersMap.get(month) || 0
   }));

   // 4. Order status distribution
   const orderStatusDistribution = await Order.aggregate([
      {
         $group: {
            _id: '$status',
            count: { $sum: 1 }
         }
      },
      {
         $project: {
            _id: 0,
            status: {
               $cond: {
                  if: { $eq: ['$_id', 'Completed'] },
                  then: 'delivered',
                  else: { $toLower: '$_id' }
               }
            },
            count: 1
         }
      }
   ]);

   return {
      totalRevenue,
      totalOrders,
      totalUsers,
      totalShops,
      totalProducts,
      monthlyRevenue,
      monthlyOrders,
      orderStatusDistribution,
      newUsersPerMonth
   };
};

const getVendorMeta = async (authUser: IJwtPayload) => {
   const shop = await Shop.findOne({ user: authUser.userId });
   if (!shop) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Vendor shop not found');
   }

   const totalRevenueAgg = await Order.aggregate([
      {
         $match: {
            shop: shop._id,
            paymentStatus: 'Paid'
         }
      },
      {
         $group: {
            _id: null,
            total: { $sum: '$finalAmount' }
         }
      }
   ]);
   const totalRevenue = totalRevenueAgg[0]?.total || 0;

   const totalOrders = await Order.countDocuments({ shop: shop._id });
   const totalProducts = await Product.countDocuments({ shop: shop._id });

   const sixMonthsAgo = new Date();
   sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
   sixMonthsAgo.setDate(1);
   sixMonthsAgo.setHours(0, 0, 0, 0);

   // 1. Monthly sales
   const monthlySalesAgg = await Order.aggregate([
      {
         $match: {
            shop: shop._id,
            paymentStatus: 'Paid',
            createdAt: { $gte: sixMonthsAgo }
         }
      },
      {
         $group: {
            _id: {
               year: { $year: '$createdAt' },
               month: { $month: '$createdAt' }
            },
            revenue: { $sum: '$finalAmount' }
         }
      }
   ]);

   const monthsList = getLast6Months();
   const salesMap = new Map<string, number>();
   monthlySalesAgg.forEach(item => {
      const monthStr = new Date(item._id.year, item._id.month - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
      salesMap.set(monthStr, item.revenue);
   });
   const monthlySales = monthsList.map(month => ({
      month,
      revenue: salesMap.get(month) || 0
   }));

   // 2. Category revenue aggregation
   const categoryRevenue = await Order.aggregate([
      {
         $match: {
            shop: shop._id,
            paymentStatus: 'Paid'
         }
      },
      {
         $unwind: '$products'
      },
      {
         $lookup: {
            from: 'products',
            localField: 'products.product',
            foreignField: '_id',
            as: 'productDetails'
         }
      },
      {
         $unwind: '$productDetails'
      },
      {
         $lookup: {
            from: 'categories',
            localField: 'productDetails.category',
            foreignField: '_id',
            as: 'categoryDetails'
         }
      },
      {
         $unwind: '$categoryDetails'
      },
      {
         $group: {
            _id: '$categoryDetails.name',
            revenue: { $sum: { $multiply: ['$products.quantity', '$products.unitPrice'] } }
         }
      },
      {
         $project: {
            _id: 0,
            category: '$_id',
            revenue: 1
         }
      }
   ]);

   // 3. Today's sales
   const todayStart = new Date();
   todayStart.setHours(0, 0, 0, 0);

   const todaySalesAgg = await Order.aggregate([
      {
         $match: {
            shop: shop._id,
            paymentStatus: 'Paid',
            createdAt: { $gte: todayStart }
         }
      },
      {
         $group: {
            _id: null,
            total: { $sum: '$finalAmount' }
         }
      }
   ]);
   const todaySales = todaySalesAgg[0]?.total || 0;

   return {
      totalRevenue,
      totalOrders,
      totalProducts,
      monthlySales,
      categoryRevenue,
      todaySales
   };
};

export const MetaService = {
   getAdminMeta,
   getVendorMeta,
};
