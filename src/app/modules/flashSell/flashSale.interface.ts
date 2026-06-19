import { Types } from "mongoose";

export interface IFlashSale {
  product: Types.ObjectId;
  discountPercentage: number;
  createdBy?: Types.ObjectId;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
}

export interface ICreateFlashSaleInput {
  products: string[];
  discountPercentage: number;
  startTime: Date;
  endTime: Date;
}