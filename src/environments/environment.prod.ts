// Production environment configuration
export const environment = {
  production: true,
  apiUrl: 'http://Thuraya.eba-kirxv8kd.eu-north-1.elasticbeanstalk.com/api',
  version: '1.0.0',
  // Google OAuth Client ID
  googleClientId: '826988304508-nb0662tfl3uo5b0b87tmvkvmsbtn6g44.apps.googleusercontent.com',
  features: {
    offlineMode: true,
    analytics: true,
    debugMode: false
  }
};
