export default {
  env: {
    API_BASE_URL: JSON.stringify(process.env.API_BASE_URL || "http://127.0.0.1:8080"),
    H5_PUBLIC_ORIGIN: JSON.stringify(process.env.H5_PUBLIC_ORIGIN || "")
  }
};
