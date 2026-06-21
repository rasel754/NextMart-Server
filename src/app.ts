import cors from "cors";
import express, { Application, NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
import os from "os";
import { StatusCodes } from "http-status-codes";
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import router from "./app/routes";
import globalErrorHandler from "./app/middleware/globalErrorHandler";
import notFound from "./app/middleware/notFound";
import requestIdMiddleware from './app/middleware/requestId';
import AppError from './app/errors/appError';

const app: Application = express();

// Request ID middleware first
app.use(requestIdMiddleware);

// Global Security headers
app.use(helmet());

// Tighten CORS
const allowedOrigins = [
  "https://next-mart-client-sable.vercel.app",
  "http://localhost:3000"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new AppError(StatusCodes.FORBIDDEN, "Not allowed by CORS"));
    }
  },
  credentials: true
}));

// Input sanitization against NoSQL injection
app.use(mongoSanitize());


app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1", router);

// seedAdmin();

// Test route
app.get("/", (req: Request, res: Response, next: NextFunction) => {
  const currentDateTime = new Date().toISOString();
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const serverHostname = os.hostname();
  const serverPlatform = os.platform();
  const serverUptime = os.uptime();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Welcome to the Next Mart",
    version: "1.0.0",
    clientDetails: {
      ipAddress: clientIp,
      accessedAt: currentDateTime,
    },
    serverDetails: {
      hostname: serverHostname,
      platform: serverPlatform,
      uptime: `${Math.floor(serverUptime / 60 / 60)} hours ${Math.floor(
        (serverUptime / 60) % 60
      )} minutes`,
    },
    developerContact: {
      email: "fahimfiroz.ph@gmail.com",
      website: "https://programming-hero.com",
    },
  });
});

app.use(globalErrorHandler);

//Not Found
app.use(notFound);

export default app; // Export the app for use in server.ts
