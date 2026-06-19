import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { requestContextStorage, logger } from '../utils/logger';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
   const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
   req.id = requestId;
   res.setHeader('x-request-id', requestId);

   const context = {
      requestId,
      method: req.method,
      url: req.originalUrl
   };

   requestContextStorage.run(context, () => {
      logger.info(`Incoming request: ${req.method} ${req.originalUrl}`);
      
      const start = Date.now();
      res.on('finish', () => {
         const duration = Date.now() - start;
         logger.info(`Request completed: ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
      });

      next();
   });
};

export default requestIdMiddleware;
