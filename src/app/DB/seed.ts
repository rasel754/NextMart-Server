import User from '../modules/user/user.model';
import { UserRole } from '../modules/user/user.interface';
import { Category } from '../modules/category/category.model';
import { Brand } from '../modules/brand/brand.model';

const seedAdminAndData = async () => {
   try {
      // 1. Seed Admin
      let admin = await User.findOne({ email: 'admin@nextmart.com' });
      if (!admin) {
         admin = await User.create({
            name: 'System Admin',
            email: 'admin@nextmart.com',
            password: 'Admin@1234',
            role: UserRole.ADMIN,
            clientInfo: {
               device: 'pc',
               browser: 'System',
               ipAddress: '127.0.0.1',
               userAgent: 'Seed Script',
            },
         });
         console.log('Admin account seeded successfully.');
      }

      // 2. Seed User
      let user = await User.findOne({ email: 'user@nextmart.com' });
      if (!user) {
         user = await User.create({
            name: 'Regular User',
            email: 'user@nextmart.com',
            password: 'User@1234',
            role: UserRole.USER,
            clientInfo: {
               device: 'pc',
               browser: 'System',
               ipAddress: '127.0.0.1',
               userAgent: 'Seed Script',
            },
         });
         console.log('User account seeded successfully.');
      }

      // 3. Seed Categories (6 sample categories)
      const categoriesData = [
         { name: 'Electronics', icon: 'https://img.icons8.com/color/48/electronics.png' },
         { name: 'Fashion', icon: 'https://img.icons8.com/color/48/t-shirt.png' },
         { name: 'Home & Kitchen', icon: 'https://img.icons8.com/color/48/kitchen.png' },
         { name: 'Beauty & Personal Care', icon: 'https://img.icons8.com/color/48/lipstick.png' },
         { name: 'Sports & Outdoors', icon: 'https://img.icons8.com/color/48/basketball.png' },
         { name: 'Books & Stationery', icon: 'https://img.icons8.com/color/48/book.png' },
      ];

      for (const cat of categoriesData) {
         const exists = await Category.findOne({ name: cat.name });
         if (!exists) {
            await Category.create({
               name: cat.name,
               slug: cat.name.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-'),
               icon: cat.icon,
               createdBy: admin._id,
               isActive: true,
            });
            console.log(`Category "${cat.name}" seeded.`);
         }
      }

      // 4. Seed Brands (5 sample brands)
      const brandsData = [
         { name: 'Apple', logo: 'https://logo.clearbit.com/apple.com' },
         { name: 'Samsung', logo: 'https://logo.clearbit.com/samsung.com' },
         { name: 'Nike', logo: 'https://logo.clearbit.com/nike.com' },
         { name: 'Sony', logo: 'https://logo.clearbit.com/sony.com' },
         { name: 'Dell', logo: 'https://logo.clearbit.com/dell.com' },
      ];

      for (const brand of brandsData) {
         const exists = await Brand.findOne({ name: brand.name });
         if (!exists) {
            await Brand.create({
               name: brand.name,
               logo: brand.logo,
               createdBy: admin._id,
               isActive: true,
            });
            console.log(`Brand "${brand.name}" seeded.`);
         }
      }
   } catch (error) {
      console.error('Error during seeding:', error);
   }
};

export default seedAdminAndData;
