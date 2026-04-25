export default {
  env: {
    API_BASE_URL: process.env.API_BASE_URL ? JSON.stringify(process.env.API_BASE_URL) : '"https://api.your-domain.com"',
    H5_PUBLIC_ORIGIN: process.env.H5_PUBLIC_ORIGIN ? JSON.stringify(process.env.H5_PUBLIC_ORIGIN) : '""'
  }
};
