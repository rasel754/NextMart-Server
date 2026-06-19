import { StatusCodes } from "http-status-codes";
import AppError from "../../errors/appError";
import { IJwtPayload } from "../auth/auth.interface";
import { ICreateFlashSaleInput, IFlashSale } from "./flashSale.interface";
import { FlashSale } from "./flashSale.model";
import User from "../user/user.model";
import Shop from "../shop/shop.model";
import QueryBuilder from "../../builder/QueryBuilder";
import { Product } from "../product/product.model";


const createFlashSale = async (flashSellData: ICreateFlashSaleInput, authUser: IJwtPayload) => {
  const userHasShop = await User.findById(authUser.userId).select('isActive hasShop');

  if (!userHasShop) throw new AppError(StatusCodes.NOT_FOUND, "User not found!");
  if (!userHasShop.isActive) throw new AppError(StatusCodes.BAD_REQUEST, "User account is not active!");
  if (!userHasShop.hasShop) throw new AppError(StatusCodes.BAD_REQUEST, "User does not have any shop!");

  const shopIsActive = await Shop.findOne({
    user: userHasShop._id,
    isActive: true
  }).select("isActive");

  if (!shopIsActive) throw new AppError(StatusCodes.BAD_REQUEST, "Shop is not active!");

  const { products, discountPercentage, startTime, endTime } = flashSellData;
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

  const result = await FlashSale.bulkWrite(operations);
  return result;
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



export const FlashSaleService = {
  createFlashSale,
  getActiveFlashSalesService
}