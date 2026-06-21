import { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import { ProductService } from "./product.service";
import { IImageFiles } from "../../interface/IImageFile";
import { IJwtPayload } from "../auth/auth.interface";
import sendResponse from "../../utils/sendResponse";
import { StatusCodes } from "http-status-codes";

const createProduct = catchAsync(async (req: Request, res: Response) => {
  const result =
    req.user.role === "admin"
      ? await ProductService.createOfficialProductIntoDB(
          req.body,
          req.files as IImageFiles
        )
      : await ProductService.createProduct(
          req.body,
          req.files as IImageFiles,
          req.user as IJwtPayload
        );

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Product created successfully",
    data: result,
  });
});

const getAllProduct = catchAsync(async (req, res) => {
  const result = await ProductService.getAllProduct(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Products are retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

const getTrendingProducts = catchAsync(async (req, res) => {
  const { limit } = req.query;
  const result = await ProductService.getTrendingProducts(Number(limit));

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Products are retrieved successfully",
    data: result,
  });
});
const getSingleProduct = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const result = await ProductService.getSingleProduct(productId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product retrieved successfully",
    data: result,
  });
});

const getMyShopProducts = catchAsync(async (req, res) => {
  const result = await ProductService.getMyShopProducts(
    req.query,
    req.user as IJwtPayload
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Products are retrieved successfully",
    meta: result.meta,
    data: result.result,
  });
});

const updateProduct = catchAsync(async (req, res) => {
  const {
    user,
    body: payload,
    params: { productId },
  } = req;

  const result = await ProductService.updateProduct(
    productId,
    payload,
    req.files as IImageFiles,
    user as IJwtPayload
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product updated successfully",
    data: result,
  });
});

// hard delete
const deleteProduct = catchAsync(async (req, res) => {
  const {
    user,
    params: { productId },
  } = req;

  const result = await ProductService.deleteProduct(
    productId,
    user as IJwtPayload
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Product deleted successfully",
    data: result,
  });
});

const toggleWishlist = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const result = await ProductService.toggleWishlist(productId, req.user as IJwtPayload);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.message,
    data: result.wishlist,
  });
});

const getWishlist = catchAsync(async (req, res) => {
  const result = await ProductService.getWishlist(req.user as IJwtPayload);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Wishlist retrieved successfully",
    data: result,
  });
});

export const ProductController = {
  createProduct,
  getAllProduct,
  getTrendingProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
  getMyShopProducts,
  toggleWishlist,
  getWishlist,
};
