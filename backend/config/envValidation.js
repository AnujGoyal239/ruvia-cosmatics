// Environment variable validation
// Validate "always required" vars and warn on feature-specific vars in development.

const alwaysRequiredEnvVars = [
  'JWT_SECRET',
  'MONGO_URI',
];

const prodRequiredEnvVars = [
  // Payments
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  // Media
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const optionalEnvVars = [
  'ADMIN_PASSWORD',
  'ADMIN_NOTIFICATIONS_EMAIL',
  'CORS_ORIGINS',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASS',
  'EMAIL_ENABLED',
  'EMAIL_FROM_NAME',
  'EMAIL_FROM_EMAIL',
  'EMAIL_REPLY_TO',
  'EMAIL_BRAND_NAME',
  'EMAIL_SUPPORT_EMAIL',
  'FRONTEND_URL',
  'NODE_ENV',
];

const validateEnvVars = () => {
  const missingCritical = [];
  for (const varName of alwaysRequiredEnvVars) {
    if (!process.env[varName]) missingCritical.push(varName);
  }

  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  if (isProd) {
    for (const varName of prodRequiredEnvVars) {
      if (!process.env[varName]) missingCritical.push(varName);
    }
  }

  if (missingCritical.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables:');
    missingCritical.forEach((varName) => console.error(`   - ${varName}`));
    console.error('\nPlease set these environment variables before starting the server.');
    console.error('Create a .env file based on .env.example');
    process.exit(1);
  }

  const missingOptional = [];
  for (const varName of optionalEnvVars) {
    if (!process.env[varName]) missingOptional.push(varName);
  }

  // In non-prod, we warn if feature vars are missing so local dev still works.
  if (missingOptional.length > 0) {
    console.warn('⚠️  Warning: Missing optional environment variables:');
    missingOptional.forEach((varName) => console.warn(`   - ${varName}`));
    console.warn('Some features may not work correctly without these variables.\n');
  }

  console.log('✅ Environment validation passed');
  return true;
};

module.exports = { validateEnvVars };
