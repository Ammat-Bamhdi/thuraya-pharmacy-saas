// Production environment configuration
export const environment = {
  production: true,
  apiUrl: 'https://api.thuraya-pharmacy.com/api',
  version: '1.0.0',
  // Google OAuth Client ID - Set in production deployment
  googleClientId: '', // Production Google Client ID
  features: {
    offlineMode: true,
    analytics: true,
    debugMode: false
  }
};
