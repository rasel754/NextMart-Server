import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/appError";
import { IJwtPayload } from "../auth/auth.interface";
import { ICreateFlashSaleInput, IFlashSale } from "./flashSale.interface";
import { FlashSale } from "./flashSale.model";
import User from "../user/user.model";
import Shop from "../shop/shop.model";
import QueryBuilder from "../../builder/QueryBuilder";
import { Product } from "../product/product.model";
import { UserRole } from "../user/user.interface";


const createFlashSale = async (flashSellData: ICreateFlashSaleInput, authUser: IJwtPayload) => {
  if (authUser.role === UserRole.ADMIN) {
    const adminUser = await User.findById(authUser.userId).select('isActive');
    if (!adminUser) throw new AppError(StatusCodes.NOT_FOUND, "User not found!");
    if (!adminUser.isActive) throw new AppError(StatusCodes.BAD_REQUEST, "User account is not active!");
  } else {
    const userHasShop = await User.findById(authUser.userId).select('isActive hasShop');

    if (!userHasShop) throw new AppError(StatusCodes.NOT_FOUND, "User not found!");
    if (!userHasShop.isActive) throw new AppError(StatusCodes.BAD_REQUEST, "User account is not active!");
    if (!userHasShop.hasShop) throw new AppError(StatusCodes.BAD_REQUEST, "User does not have any shop!");

    const shopIsActive = await Shop.findOne({
      user: userHasShop._id,
      isActive: true
    }).select("isActive");

    if (!shopIsActive) throw new AppError(StatusCodes.BAD_REQUEST, "Shop is not active!");
  }

  const { products: inputProducts, product: inputProduct, discountPercentage, startTime, endTime } = flashSellData;

  let products: string[] = [];
  if (inputProducts && Array.isArray(inputProducts)) {
    products = inputProducts;
  } else if (inputProduct) {
    products = [inputProduct];
  }

  if (products.length === 0) {
    throw new AppError(StatusCodes.BAD_REQUEST, "No products specified for flash sale.");
  }

  const createdBy = authUser.userId;

  const operations = products.map((product) => ({
    updateOne: {
      filter: { product },
      update: {
        $set: {
          product,
          discountPercentage,
          createdBy,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          isActive: false
        },
      },
      upsert: true,
    },
  }));

  await FlashSale.bulkWrite(operations);

  const updatedSales = await FlashSale.find({ product: { $in: products } }).populate({
    path: 'product',
    populate: { path: 'category brand shop' }
  });

  if (inputProduct && updatedSales.length > 0) {
    return updatedSales[0];
  }

  return updatedSales;
};

const getActiveFlashSalesService = async (query: Record<string, unknown>) => {
  const flashSaleQuery = new QueryBuilder(
    FlashSale.find({ isActive: true })
      .populate({
        path: 'product',
        populate: { path: 'category brand shop' }
      }),
    query
  )
    .paginate();

  const flashSales = await flashSaleQuery.modelQuery.lean();
  const meta = await flashSaleQuery.countTotal();

  const productsWithOfferPrice = flashSales.map((sale: any) => {
    const product = sale.product;
    if (product) {
      const discount = (sale.discountPercentage / 100) * product.price;
      product.offerPrice = product.price - discount;
      product.flashSalePrice = product.price - discount;
      product.isOnFlashSale = true;
      return product;
    }
    return null;
  }).filter(Boolean);

  return {
    meta,
    result: productsWithOfferPrice,
  };
};

const getAllFlashSalesSchedules = async (query: Record<string, unknown>) => {
  const flashSaleQuery = new QueryBuilder(
    FlashSale.find()
      .populate({
        path: 'product',
        populate: { path: 'category brand shop' }
      }),
    query
  )
    .paginate();

  const result = await flashSaleQuery.modelQuery.lean();
  const meta = await flashSaleQuery.countTotal();

  return {
    meta,
    result,
  };
};

const updateFlashSale = async (id: string, payload: Partial<IFlashSale>) => {
  const sale = await FlashSale.findById(id);
  if (!sale) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Flash sale schedule not found.');
  }

  const updatedSale = await FlashSale.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true }
  ).populate({
    path: 'product',
    populate: { path: 'category brand shop' }
  });

  if (!updatedSale) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Failed to update flash sale.');
  }

  // Immediate adjustment for active status
  const now = new Date();
  const isCurrentlyActive = new Date(updatedSale.startTime) <= now && new Date(updatedSale.endTime) >= now;
  const product = await Product.findById(updatedSale.product);
  if (product) {
    if (isCurrentlyActive) {
      const discount = (updatedSale.discountPercentage / 100) * product.price;
      product.flashSalePrice = product.price - discount;
      product.isOnFlashSale = true;
      await product.save();
      updatedSale.isActive = true;
      await updatedSale.save();
    } else {
      product.flashSalePrice = null;
      product.isOnFlashSale = false;
      await product.save();
      updatedSale.isActive = false;
      await updatedSale.save();
    }
  }

  return updatedSale;
};

const deleteFlashSale = async (id: string) => {
  const sale = await FlashSale.findById(id);
  if (!sale) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Flash sale schedule not found.');
  }

  const product = await Product.findById(sale.product);
  if (product) {
    product.flashSalePrice = null;
    product.isOnFlashSale = false;
    await product.save();
  }

  await FlashSale.findByIdAndDelete(id);
  return { message: 'Flash sale schedule deleted successfully.' };
};

export const FlashSaleService = {
  createFlashSale,
  getActiveFlashSalesService,
  getAllFlashSalesSchedules,
  updateFlashSale,
  deleteFlashSale
};