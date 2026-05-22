// Environment variable validation
// This file validates that all required environment variables are set at startup

const requiredEnvVars = [
  'JWT_SECRET',
  'MONGO_URI',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'CLERK_SECRET_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

const optionalEnvVars = [
  'ADMIN_PASSWORD',
  'CORS_ORIGINS',
  'EMAIL_HOST',
  'EMAIL_PORT',
  'EMAIL_USER',
  'EMAIL_PASS',
  'NODE_ENV'
];

const validateEnvVars = () => {
  const missingVars = [];

  // Check required environment variables
  requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.error('❌ CRITICAL: Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease set these environment variables before starting the server.');
    console.error('Create a .env file based on .env.example');
    process.exit(1);
  }

  // Warn about optional environment variables
  const missingOptional = [];
  optionalEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      missingOptional.push(varName);
    }
  });

  if (missingOptional.length > 0) {
    console.warn('⚠️  Warning: Missing optional environment variables:');
    missingOptional.forEach(varName => {
      console.warn(`   - ${varName}`);
    });
    console.warn('Some features may not work correctly without these variables.\n');
  }

  console.log('✅ All required environment variables are set');
  return true;
};

module.exports = { validateEnvVars };
