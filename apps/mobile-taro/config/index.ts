import { defineConfig } from "@tarojs/cli";

import devConfig from "./dev";
import prodConfig from "./prod";

const envConfig = process.env.NODE_ENV === "development" ? devConfig : prodConfig;
const isDev = process.env.NODE_ENV === "development";

export default defineConfig({
  projectName: "yao-lawyer-mobile",
  date: "2026-04-17",
  designWidth: 375,
  deviceRatio: {
    375: 2,
    640: 1.17,
    750: 1,
    828: 0.905
  },
  sourceRoot: "src",
  outputRoot: "dist",
  plugins: [],
  framework: "react",
  compiler: "webpack5",
  mini: {
    postcss: {
      pxtransform: {
        enable: true
      }
    }
  },
  h5: {
    // Dev server needs an absolute publicPath, while production can keep relative assets.
    publicPath: isDev ? "/" : "./",
    staticDirectory: "static"
  },
  ...envConfig
});
