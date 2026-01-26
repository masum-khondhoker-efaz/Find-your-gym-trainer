import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import router from './app/routes';
import { logger, loggerConsole } from './app/middlewares/logger';
import path from 'path';
import bodyParser from 'body-parser';
// import { PaymentController } from './app/modules/payment/payment.controller';
import { helmetConfig } from './config/helemt';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
// import { doubleCsrf } from 'csrf-csrf';

const app: Application = express();

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  // max: Number(process.env.RATE_LIMIT_MAX), // Limit each IP to 100 requests per windowMs
  max: 1000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

app.use(logger);
app.use(loggerConsole);

// Apply rate limiting to all requests
app.use(limiter);

app.use(
  cors({
    origin: [
      'http://localhost:3001',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://13.62.189.94:5173',
      'http://13.62.189.94:5174',
      'http://13.62.189.94:3000',
      'http://13.62.189.94',
      'http://10.10.20.60:3000',
      'http://10.10.20.34:3000',
      'http://10.10.20.42:5173',
      'http://10.10.20.34:3000',
      'http://10.10.20.13:3000',
      'https://ecommerce-website-rho-lemon.vercel.app',
      'https://ecommerce-website-alpha-olive.vercel.app',
      'https://hatem-dashboard-iota.vercel.app',
      'https://hatem-dashboard.vercel.app',
      'https://sparedoc.com',
      'https://www.sparedoc.com',
      'https://dashboard.sparedoc.com',
      'https://www.dashboard.sparedoc.com',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  }),
);
// app.use(
//   cors({
//     origin: true,
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//   }),
// );
// app.use(
//   cors(
//     {
//     origin: "*", // Allow all origins for development
//     credentials: true, // Allow credentials
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//   }
// )
// );

// app.use(
//   '/api/v1/stripe/payment-webhook',
//   express.raw({ type: 'application/json' }),
//   PaymentController.handleWebHook,
// );

//parser
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmetConfig);

// app.set('trust proxy', true);
// // 2. Configure CSRF options
// const { invalidCsrfTokenError, doubleCsrfProtection } = doubleCsrf({
//   getSecret: () => process.env.CSRF_SECRET || 'default-csrf-secret',
//   cookieName: 'x-csrf-token',
//   cookieOptions: {
//     httpOnly: true,
//     sameSite: 'none', // Changed to 'none' for cross-origin requests (requires secure:true in production)
//     secure: process.env.NODE_ENV === 'production', // Must be false for HTTP. Set to true for HTTPS (required with sameSite:'none')
//     maxAge: 24 * 60 * 60 * 1000,
//   },
//   // Use a static session identifier for development to avoid IP address issues
//   // In production, use express-session for proper session management
//   getSessionIdentifier: req => {
//     // Use a consistent identifier instead of unstable req.ip
//     return 'static-dev-session';
//   },
//   getCsrfTokenFromRequest: req => {
//     // console.log('Headers:', req.headers);
//     // console.log('SessionID:', (req as any).sessionID, 'IP:', req.ip);
//     // console.log('Cookies:', req.cookies);
//     return (req.headers['x-csrf-token'] as string) || '';
//   },
// });

// --- ROUTES ---

// 4. Endpoint to get the token (The frontend calls this first)
app.get('/api/v1/csrf-token',
  //  doubleCsrfProtection, 
   (req, res) => {
  const token = (req as any).csrfToken();
  // console.log('CSRF Token generated:', token);
  res.json({ token });
});

app.get('/', (req: Request, res: Response) => {
  res.send({
    Message: 'SpareDoc server is now live. . .',
  });
});
// Serve static files from 'public' folder
app.use(express.static(path.join(process.cwd(), 'public')));

// Conditionally apply CSRF protection based on environment
const isDevelopment =
  process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
if (isDevelopment) {
  // console.log('⚠️  CSRF Protection DISABLED for development environment');
  app.use('/api/v1', router);
} else {
  // console.log('✓ CSRF Protection ENABLED for production environment');
  app.use('/api/v1',
    //  doubleCsrfProtection, 
     router);
}

// 3. Error Handling Middleware for CSRF
// app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
//   if (error === invalidCsrfTokenError) {
//     // console.log(error, req.headers['x-csrf-token'])
//     res.status(403).json({ error: 'Invalid CSRF token' });
//   } else {
//     next(error);
//   }
// });

app.use(globalErrorHandler);

app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: 'API NOT FOUND!',
    error: {
      path: req.originalUrl,
      message: 'Your requested path is not found!',
    },
  });
});

export default app;
