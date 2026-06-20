import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import { ShopService } from './shop.service';
import { IImageFile } from '../../interface/IImageFile';
import { IJwtPayload } from '../auth/auth.interface';
import sendResponse from '../../utils/sendResponse';
import { StatusCodes } from 'http-status-codes';

const createShop = catchAsync(async (req: Request, res: Response) => {
  const result = await ShopService.createShop(
    req.body,
    req.file as IImageFile,
    req.user as IJwtPayload
  );

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Shop created successfully!',
    data: result
  });
});

const getMyShop = catchAsync(async (req: Request, res: Response) => {
  const result = await ShopService.getMyShop(
    req.user as IJwtPayload
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shop retrive successfully!',
    data: result
  });
});

const getAllShops = catchAsync(async (req: Request, res: Response) => {
  const result = await ShopService.getAllShops(req.query);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shops fetched successfully!',
    meta: result.meta,
    data: result.result
  });
});

const getSingleShop = catchAsync(async (req: Request, res: Response) => {
  const result = await ShopService.getSingleShop(req.params.id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shop fetched successfully!',
    data: result
  });
});

const toggleShopStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await ShopService.toggleShopStatus(req.params.id, req.body.status);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shop status toggled successfully!',
    data: result
  });
});

const deleteShop = catchAsync(async (req: Request, res: Response) => {
  const result = await ShopService.deleteShop(req.params.id);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Shop deleted successfully!',
    data: result
  });
});

export const ShopController = {
  createShop,
  getMyShop,
  getAllShops,
  getSingleShop,
  toggleShopStatus,
  deleteShop
};