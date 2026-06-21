import mongoose, { Schema, Document, Model } from "mongoose";
import { IShop } from "./shop.interface";

const shopSchema = new Schema<IShop>(
  {
    shopName: {
      type: String,
      required: true,
    },
    businessLicenseNumber: {
      type: String,
      required: true,
      unique: true,
    },
    address: {
      type: String,
      required: true,
    },
    contactNumber: {
      type: String,
      required: true,
    },
    website: {
      type: String,
      default: null,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    servicesOffered: {
      type: [String],
      required: true,
    },
    ratings: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    establishedYear: {
      type: Number,
      required: true,
    },
    socialMediaLinks: {
      type: Map,
      of: String,
      default: null,
    },
    taxIdentificationNumber: {
      type: String,
      required: true,
      unique: true,
    },
    logo: {
      type: String,
      default: null,
    },
    isOfficial: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

shopSchema.index(
  { isOfficial: 1 },
  { unique: true, partialFilterExpression: { isOfficial: true } }
);

const Shop: Model<IShop> = mongoose.model<IShop>("Shop", shopSchema);
export default Shop;
