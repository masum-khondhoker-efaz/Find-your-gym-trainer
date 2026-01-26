import helmet from 'helmet';
 
export const helmetConfig = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' }, // Protects against clickjacking
  hsts: {
    maxAge: 63072000, // 2 years
    includeSubDomains: true,
    preload: true,
  },
  hidePoweredBy: true, // Removes "X-Powered-By: Express"
  ieNoOpen: true, // IE download security
  noSniff: true, // Prevents MIME type sniffing
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'no-referrer' }, // Good default for APIs
});