import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
   requestId: string;
   method: string;
   url: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

const customFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
   const store = requestContextStorage.getStore();
   const requestId = store?.requestId || metadata.requestId || 'N/A';
   const method = store?.method || metadata.method || 'N/A';
   const url = store?.url || metadata.url || 'N/A';

   return `[${timestamp}] [${requestId}] [${method} ${url}] [${level.toUpperCase()}]: ${message}`;
});

const logFormat = winston.format.combine(
   winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
   winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
   customFormat
);

export const logger = winston.createLogger({
   level: process.env.LOG_LEVEL || 'info',
   format: logFormat,
   transports: [
      new winston.transports.Console({
         format: winston.format.combine(
            winston.format.colorize(),
            logFormat
         )
      })
   ]
});

// Add file transports in production (but skip on serverless environments like Vercel)
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
   logger.add(
      new winston.transports.File({
         filename: 'logs/error.log',
         level: 'error',
         format: logFormat
      })
   );
   logger.add(
      new winston.transports.File({
         filename: 'logs/combined.log',
         format: logFormat
      })
   );
}
