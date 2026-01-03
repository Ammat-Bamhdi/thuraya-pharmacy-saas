// Development environment configuration
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
  version: '1.0.0',
  // Google OAuth Client ID - Get from Google Cloud Console
  // https://console.cloud.google.com/apis/credentials
  googleClientId: '', // Add your Google Client ID here
  features: {
    offlineMode: true,
    analytics: false,
    debugMode: true
  }
};
