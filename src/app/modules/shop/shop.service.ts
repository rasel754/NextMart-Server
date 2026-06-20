import mongoose from "mongoose";
import { IImageFile } from "../../interface/IImageFile";
import { IShop } from "./shop.interface";
import { IJwtPayload } from "../auth/auth.interface";
import User from "../user/user.model";
import AppError from "../../errors/appError";
import { StatusCodes } from "http-status-codes";
import Shop from "./shop.model";
import QueryBuilder from "../../builder/QueryBuilder";
import { Product } from "../product/product.model";
const createShop = async (shopData: Partial<IShop>, logo: IImageFile, authUser: IJwtPayload) => {

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if the user already exists by email
    const existingUser = await User.findById(authUser.userId).session(session);

    if (!existingUser) {
      throw new AppError(StatusCodes.NOT_ACCEPTABLE, 'User is not exists!');
    }

    if (!existingUser.isActive) {
      throw new AppError(StatusCodes.NOT_ACCEPTABLE, 'User is not active!');
    }

    if (logo) {
      shopData.logo = logo.path
    }

    const shop = new Shop({
      ...shopData,
      user: existingUser._id
    });

    const createdShop = await shop.save({ session });

    await User.findByIdAndUpdate(
      existingUser._id,
      { hasShop: true },
      { new: true, session }
    );

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    return createdShop;
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

const getMyShop = async (authUser: IJwtPayload) => {
  const existingUser = await User.checkUserExist(authUser.userId);
  if (!existingUser.hasShop) {
    throw new AppError(StatusCodes.NOT_FOUND, "You have no shop!")
  }

  const shop = await Shop.findOne({ user: existingUser._id }).populate('user');
  return shop;
};

const getAllShops = async (query: Record<string, unknown>) => {
  const shopQuery = new QueryBuilder(Shop.find().populate('user'), query)
    .search(['shopName'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await shopQuery.modelQuery;
  const meta = await shopQuery.countTotal();
  return { result, meta };
};

const getSingleShop = async (id: string) => {
  const result = await Shop.findById(id).populate('user');
  if (!result) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Shop not found!');
  }
  return result;
};

const toggleShopStatus = async (id: string, status: string) => {
  const shop = await Shop.findById(id);
  if (!shop) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Shop not found!');
  }

  const isActive = status === 'active';
  shop.isActive = isActive;
  const result = await shop.save();

  // Suspend/activate products associated with this shop
  await Product.updateMany({ shop: id }, { isActive });

  return result;
};

const deleteShop = async (id: string) => {
  const shop = await Shop.findById(id);
  if (!shop) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Shop not found!');
  }

  // Deleting a shop should also deactivate/hide all products under it
  await Product.updateMany({ shop: id }, { isActive: false });

  // Update hasShop
  if (shop.user) {
    await User.findByIdAndUpdate(shop.user, { hasShop: false });
  }

  const result = await Shop.findByIdAndDelete(id);
  return result;
};

export const ShopService = {
  createShop,
  getMyShop,
  getAllShops,
  getSingleShop,
  toggleShopStatus,
  deleteShop
};