// server/config/cors.js
// Configuration CORS

export const allowedOrigins = [
  'http://localhost:5173',
  'https://inaturamouche.netlify.app',
  'https://inaturaquizz.netlify.app',
];

export const corsOptions = {
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error('Origin not allowed by CORS'));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'X-Cache-Key',
    'X-Lures-Relaxed',
    'X-Lure-Buckets',
    'X-Pool-Pages',
    'X-Pool-Obs',
    'X-Pool-Taxa',
    'Server-Timing',
    'X-Timing',
  ],
};

export default corsOptions;
