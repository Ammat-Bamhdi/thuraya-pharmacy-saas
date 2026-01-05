// Production environment configuration
export const environment = {
  production: true,
  // CloudFront HTTPS proxy to AWS Elastic Beanstalk
  apiUrl: 'https://d1duu60y0sihvr.cloudfront.net/api',
  version: '1.0.0',
  // Google OAuth Client ID
  googleClientId: '826988304508-nb0662tfl3uo5b0b87tmvkvmsbtn6g44.apps.googleusercontent.com',
  features: {
    offlineMode: true,
    analytics: true,
    debugMode: false
  }
};
