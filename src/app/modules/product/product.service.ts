import { StatusCodes } from 'http-status-codes';
import AppError from '../../errors/appError';
import { IImageFile, IImageFiles } from '../../interface/IImageFile';
import { IJwtPayload } from '../auth/auth.interface';
import User from '../user/user.model';
import { UserRole } from '../user/user.interface';
import { IProduct } from './product.interface';
import { Category } from '../category/category.model';
import { Product } from './product.model';
import { Brand } from '../brand/brand.model';
import QueryBuilder from '../../builder/QueryBuilder';
import { ProductSearchableFields } from './product.constant';
import { Order } from '../order/order.model';
import Shop from '../shop/shop.model';
import { IOrderProduct } from '../order/order.interface';
import { Review } from '../review/review.model';
import { FlashSale } from '../flashSell/flashSale.model';
import { off } from 'process';
import { hasActiveShop } from '../../utils/hasActiveShop';
import mongoose from 'mongoose';
const createProduct = async (
   productData: Partial<IProduct>,
   productImages: IImageFiles,
   authUser: IJwtPayload
) => {
   let shopId;
   if (authUser.role === UserRole.ADMIN) {
      if (!productData.shop) {
         throw new AppError(StatusCodes.BAD_REQUEST, 'Shop ID is required for admins to create products.');
      }
      const existingShop = await Shop.findById(productData.shop);
      if (!existingShop) {
         throw new AppError(StatusCodes.BAD_REQUEST, 'Shop does not exist!');
      }
      shopId = existingShop._id;
   } else {
      const shop = await hasActiveShop(authUser.userId);
      shopId = shop._id;
   }

   const { images } = productImages;
   if (!images || images.length === 0) {
      throw new AppError(
         StatusCodes.BAD_REQUEST,
         'Product images are required.'
      );
   }

   productData.imageUrls = images.map((image) => image.path);

   const isCategoryExists = await Category.findById(productData.category);
   if (!isCategoryExists) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Category does not exist!');
   }

   if (!isCategoryExists.isActive) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Category is not active!');
   }

   const newProduct = new Product({
      ...productData,
      shop: shopId,
   });

   const result = await newProduct.save();
   return result;
};
// const getAllProduct = async (query: Record<string, unknown>) => {
//    const { minPrice, maxPrice, ...pQuery } = query;

//    const productQuery = new QueryBuilder(
//       Product.find()
//          .populate('category', 'name')
//          .populate('shop', 'shopName')
//          .populate('brand', 'name'),
//       pQuery
//    )
//       .search(['name', 'description'])
//       .filter()
//       .sort()
//       .paginate()
//       .fields()
//       .priceRange(Number(minPrice) || 0, Number(maxPrice) || Infinity);

//    const products = await productQuery.modelQuery.lean();

//    const meta = await productQuery.countTotal();

//    const productIds = products.map((product: any) => product._id);

//    const flashSales = await FlashSale.find({
//       product: { $in: productIds },
//       discountPercentage: { $gt: 0 },
//    }).select('product discountPercentage');

//    const flashSaleMap = flashSales.reduce((acc, { product, discountPercentage }) => {
//       //@ts-ignore
//       acc[product.toString()] = discountPercentage;
//       return acc;
//    }, {});

//    const updatedProducts = products.map((product: any) => {
//       //@ts-ignore
//       const discountPercentage = flashSaleMap[product._id.toString()];
//       if (discountPercentage) {
//          product.offerPrice = product.price * (1 - discountPercentage / 100);
//       } else {
//          product.offerPrice = null;
//       }
//       return product;
//    });

//    return {
//       meta,
//       result: updatedProducts,
//    };
// };

// Product.service.ts

const getAllProduct = async (query: Record<string, unknown>) => {
   const {
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      rating,
      inStock,
      flashSale,
      sort,
      page,
      limit,
      ...pQuery
   } = query;

   // Build the filter object
   const filter: Record<string, any> = {};

   // 1. Search Filter: partial match on title (name) & description
   if (search) {
      filter.$or = [
         { name: { $regex: search as string, $options: 'i' } },
         { description: { $regex: search as string, $options: 'i' } }
      ];
   }

   // 2. Category Filter: Category ID or slug
   if (category) {
      if (mongoose.Types.ObjectId.isValid(category as string)) {
         filter.category = new mongoose.Types.ObjectId(category as string);
      } else {
         const foundCategory = await Category.findOne({ slug: category as string });
         if (foundCategory) {
            filter.category = foundCategory._id;
         } else {
            filter.category = new mongoose.Types.ObjectId();
         }
      }
   }

   // 3. Brand Filter: Brand ID or slug
   if (brand) {
      if (mongoose.Types.ObjectId.isValid(brand as string)) {
         filter.brand = new mongoose.Types.ObjectId(brand as string);
      } else {
         const foundBrand = await Brand.findOne({
            $or: [
               { name: brand as string },
               { name: { $regex: new RegExp(`^${(brand as string).replace(/-/g, ' ')}$`, 'i') } }
            ]
         });
         if (foundBrand) {
            filter.brand = foundBrand._id;
         } else {
            filter.brand = new mongoose.Types.ObjectId();
         }
      }
   }

   // 4. Price range filter
   if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) {
         filter.price.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined) {
         filter.price.$lte = Number(maxPrice);
      }
   }

   // 5. Rating filter
   if (rating) {
      filter.averageRating = { $gte: Number(rating) };
   }

   // 6. Stock filter
   if (inStock !== undefined) {
      if (inStock === 'true') {
         filter.stock = { $gt: 0 };
      } else if (inStock === 'false') {
         filter.stock = 0;
      }
   }

   // 7. Flash sale filter
   if (flashSale === 'true') {
      filter.isOnFlashSale = true;
   }

   // Sorting
   let sortOption = '-createdAt';
   if (sort) {
      if (sort === 'price_asc') {
         sortOption = 'price';
      } else if (sort === 'price_desc') {
         sortOption = '-price';
      } else if (sort === 'newest') {
         sortOption = '-createdAt';
      } else if (sort === 'popular') {
         sortOption = '-views';
      }
   }

   // Pagination
   const pageNumber = Number(page) || 1;
   const limitNumber = Math.min(Number(limit) || 10, 50);
   const skip = (pageNumber - 1) * limitNumber;

   const products = await Product.find(filter)
      .populate('category', 'name')
      .populate('shop', 'shopName')
      .populate('brand', 'name')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber)
      .lean();

   const total = await Product.countDocuments(filter);
   const totalPage = Math.ceil(total / limitNumber);

   return {
      meta: {
         page: pageNumber,
         limit: limitNumber,
         total,
         totalPage
      },
      result: products,
   };
};


const getTrendingProducts = async (limit: number) => {
   const now = new Date();
   const last30Days = new Date(now.setDate(now.getDate() - 30));

   const trendingProducts = await Order.aggregate([
      {
         $match: {
            createdAt: { $gte: last30Days },
         },
      },
      {
         $unwind: '$products',
      },
      {
         $group: {
            _id: '$products.product',
            orderCount: { $sum: '$products.quantity' },
         },
      },
      {
         $sort: { orderCount: -1 },
      },
      {
         $limit: limit || 10,
      },
      {
         $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'productDetails',
         },
      },
      {
         $unwind: '$productDetails',
      },
      {
         $project: {
            _id: 0,
            productId: '$_id',
            orderCount: 1,
            name: '$productDetails.name',
            price: '$productDetails.price',
            offer: '$productDetails.offer',
            imageUrls: '$productDetails.imageUrls',
         },
      },
   ]);

   return trendingProducts;
};

const getSingleProduct = async (productId: string) => {
   // Atomically increment views (do not await - fire and forget)
   Product.findByIdAndUpdate(productId, { $inc: { views: 1 } }).exec();

   const product = await Product.findById(productId)
      .populate("shop brand category");

   if (!product) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Product not found');
   }

   if (!product.isActive) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Product is not active');
   }

   const offerPrice = await product.calculateOfferPrice();
   const reviews = await Review.find({ product: product._id });

   const productObj = product.toObject();

   return {
      ...productObj,
      offerPrice,
      reviews
   };
};

const toggleWishlist = async (productId: string, authUser: IJwtPayload) => {
   const user = await User.findById(authUser.userId);
   if (!user) {
      throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
   }

   const productExists = await Product.findById(productId);
   if (!productExists) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Product not found');
   }

   const index = user.wishlist.indexOf(productExists._id as any);
   let message = '';
   if (index > -1) {
      user.wishlist.splice(index, 1);
      message = 'Product removed from wishlist';
   } else {
      user.wishlist.push(productExists._id as any);
      message = 'Product added to wishlist';
   }

   await user.save();
   return {
      message,
      wishlist: user.wishlist
   };
};

const getWishlist = async (authUser: IJwtPayload) => {
   const user = await User.findById(authUser.userId).populate({
      path: 'wishlist',
      populate: { path: 'category brand shop' }
   });
   if (!user) {
      throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
   }

   return user.wishlist;
};




const getMyShopProducts = async (query: Record<string, unknown>, authUser: IJwtPayload) => {
   const userHasShop = await User.findById(authUser.userId).select('isActive hasShop');

   if (!userHasShop) throw new AppError(StatusCodes.NOT_FOUND, "User not found!");
   if (!userHasShop.isActive) throw new AppError(StatusCodes.BAD_REQUEST, "User account is not active!");
   if (!userHasShop.hasShop) throw new AppError(StatusCodes.BAD_REQUEST, "User does not have any shop!");

   const shopIsActive = await Shop.findOne({
      user: userHasShop._id,
      isActive: true
   }).select("isActive");

   if (!shopIsActive) throw new AppError(StatusCodes.BAD_REQUEST, "Shop is not active!");

   const { minPrice, maxPrice, ...pQuery } = query;

   const productQuery = new QueryBuilder(
      Product.find({ shop: shopIsActive._id })
         .populate('category', 'name')
         .populate('shop', 'shopName')
         .populate('brand', 'name'),
      pQuery
   )
      .search(['name', 'description'])
      .filter()
      .sort()
      .paginate()
      .fields()
      .priceRange(Number(minPrice) || 0, Number(maxPrice) || Infinity);

   const products = await productQuery.modelQuery.lean();

   const productsWithOfferPrice = await Promise.all(
      products.map(async (product) => {
         const productDoc = await Product.findById(product._id);
         const offerPrice = productDoc?.offerPrice;
         return {
            ...product,
            offerPrice: Number(offerPrice) || null,
         };
      })
   );

   const meta = await productQuery.countTotal();

   return {
      meta,
      result: productsWithOfferPrice,
   };
};

const updateProduct = async (
   productId: string,
   payload: Partial<IProduct>,
   productImages: IImageFiles,
   authUser: IJwtPayload
) => {
   const { images } = productImages;

   const user = await User.findById(authUser.userId);
   if (!user) {
      throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
   }
   if (!user.isActive) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'User is not active');
   }

   let product;
   if (authUser.role === UserRole.ADMIN) {
      product = await Product.findById(productId);
      // Strip shop from update payload for admins
      delete (payload as any).shop;
   } else {
      const shop = await Shop.findOne({ user: user._id });
      if (!shop) {
         throw new AppError(StatusCodes.BAD_REQUEST, "You don't have a shop");
      }
      if (!shop.isActive) {
         throw new AppError(StatusCodes.BAD_REQUEST, 'Your shop is inactive');
      }
      product = await Product.findOne({
         shop: shop._id,
         _id: productId,
      });
   }

   if (!product) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Product Not Found');
   }

   if (images && images.length > 0) {
      payload.imageUrls = images.map((image) => image.path);
   }

   return await Product.findByIdAndUpdate(productId, payload, { new: true });
};

const deleteProduct = async (productId: string, authUser: IJwtPayload) => {
   const user = await User.findById(authUser.userId);
   if (!user) {
      throw new AppError(StatusCodes.NOT_FOUND, 'User not found');
   }
   if (!user.isActive) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'User is not active');
   }

   let product;
   if (authUser.role === UserRole.ADMIN) {
      product = await Product.findById(productId);
   } else {
      const shop = await Shop.findOne({ user: user._id });
      if (!shop) {
         throw new AppError(StatusCodes.BAD_REQUEST, "You don't have a shop");
      }
      product = await Product.findOne({
         shop: shop._id,
         _id: productId,
      });
   }

   if (!product) {
      throw new AppError(StatusCodes.NOT_FOUND, 'Product Not Found');
   }

   await FlashSale.deleteMany({ product: productId });

   return await Product.findByIdAndDelete(productId);
};

const createOfficialProductIntoDB = async (
   productData: Partial<IProduct>,
   productImages: IImageFiles
) => {
   const officialShop = await Shop.findOne({ isOfficial: true });
   if (!officialShop) {
      throw new AppError(
         StatusCodes.INTERNAL_SERVER_ERROR,
         "Official store not found. Please contact a developer to re-run the seed script."
      );
   }

   const { images } = productImages;
   if (!images || images.length === 0) {
      throw new AppError(
         StatusCodes.BAD_REQUEST,
         'Product images are required.'
      );
   }

   productData.imageUrls = images.map((image) => image.path);

   const isCategoryExists = await Category.findById(productData.category);
   if (!isCategoryExists) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Category does not exist!');
   }

   if (!isCategoryExists.isActive) {
      throw new AppError(StatusCodes.BAD_REQUEST, 'Category is not active!');
   }

   const newProduct = new Product({
      ...productData,
      shop: officialShop._id,
   });

   const result = await newProduct.save();
   return result;
};

export const ProductService = {
   createProduct,
   createOfficialProductIntoDB,
   getAllProduct,
   getTrendingProducts,
   getSingleProduct,
   updateProduct,
   deleteProduct,
   getMyShopProducts,
   toggleWishlist,
   getWishlist,
};
