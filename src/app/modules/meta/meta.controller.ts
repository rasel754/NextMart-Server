import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { MetaService } from './meta.service';
import { IJwtPayload } from '../auth/auth.interface';

const getAdminMeta = catchAsync(async (req, res) => {
   const result = await MetaService.getAdminMeta();

   sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Admin meta data fetched successfully',
      data: result,
   });
});

const getVendorMeta = catchAsync(async (req, res) => {
   const result = await MetaService.getVendorMeta(req.user as IJwtPayload);

   sendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Vendor meta data fetched successfully',
      data: result,
   });
});

export const MetaController = {
   getAdminMeta,
   getVendorMeta,
};
