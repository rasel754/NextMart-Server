import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { cloudinaryUpload } from './cloudinary.config';


const removeExtension = (filename: string) => {
    return filename.split('.').slice(0, -1).join('.');
};

const storage = new CloudinaryStorage({
    cloudinary: cloudinaryUpload,
    params: {
        public_id: (_req, file) =>
            Math.random().toString(36).substring(2) +
            '-' +
            Date.now() +
            '-' +
            file.fieldname +
            '-' +
            removeExtension(file.originalname),
    },
});
export const multerUpload = multer({
    storage: storage,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB max file size
    },
    fileFilter: (_req, file, callback) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (allowedMimes.includes(file.mimetype)) {
            callback(null, true);
        } else {
            callback(new Error('Invalid file type. Only jpeg, png, and webp are allowed.'));
        }
    }
});