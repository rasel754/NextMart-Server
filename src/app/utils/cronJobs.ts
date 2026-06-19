import cron from 'node-cron';
import { FlashSale } from '../modules/flashSell/flashSale.model';
import { Product } from '../modules/product/product.model';

export const startCronJobs = () => {
   cron.schedule('* * * * *', async () => {
      const now = new Date();
      try {
         // 1. Activate flash sales that should be active but are not yet
         const salesToActivate = await FlashSale.find({
            startTime: { $lte: now },
            endTime: { $gte: now },
            isActive: { $ne: true }
         });

         for (const sale of salesToActivate) {
            sale.isActive = true;
            await sale.save();

            // Update associated product details
            const product = await Product.findById(sale.product);
            if (product) {
               const discount = (sale.discountPercentage / 100) * product.price;
               product.flashSalePrice = product.price - discount;
               product.isOnFlashSale = true;
               await product.save();
               console.log(`Activated flash sale for product: ${product.name}`);
            }
         }

         // 2. Deactivate flash sales that should not be active but currently are
         const salesToDeactivate = await FlashSale.find({
            $or: [
               { endTime: { $lt: now } },
               { startTime: { $gt: now } }
            ],
            isActive: true
         });

         for (const sale of salesToDeactivate) {
            sale.isActive = false;
            await sale.save();

            // Reset product details
            const product = await Product.findById(sale.product);
            if (product) {
               product.flashSalePrice = null;
               product.isOnFlashSale = false;
               await product.save();
               console.log(`Deactivated flash sale for product: ${product.name}`);
            }
         }
      } catch (error) {
         console.error('Error executing flash sale update cron job:', error);
      }
   });
   console.log('⏰ Flash sale cron scheduler initialized.');
};
