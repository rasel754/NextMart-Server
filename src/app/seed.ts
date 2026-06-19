import mongoose from 'mongoose';
import config from './config';
import seedAdminAndData from './DB/seed';

const runSeedScript = async () => {
   try {
      console.log('Connecting to database...');
      await mongoose.connect(config.db_url as string);
      console.log('Database connected successfully. Starting seed...');

      await seedAdminAndData();

      console.log('Seeding procedure completed.');
   } catch (error) {
      console.error('Error in seed script:', error);
   } finally {
      await mongoose.disconnect();
      console.log('Database disconnected.');
      process.exit(0);
   }
};

runSeedScript();
