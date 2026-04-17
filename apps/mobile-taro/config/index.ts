import { defineConfig } from "@tarojs/cli";

import devConfig from "./dev";
import prodConfig from "./prod";

const envConfig = process.env.NODE_ENV === "development" ? devConfig : prodConfig;

export default defineConfig({
  projectName: "yao-lawyer-mobile",
  date: "2026-04-17",
  designWidth: 375,
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
    publicPath: "/",
    staticDirectory: "static"
  },
  ...envConfig
});
