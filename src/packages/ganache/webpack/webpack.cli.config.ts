import base from "./webpack.common.config";
import webpack from "webpack";
import path from "path";
import merge from "webpack-merge";

const config: webpack.Configuration = merge({}, base, {
  entry: "./src/cli.ts",
  target: "node10.7",
  output: {
    path: path.resolve(__dirname, "../", "dist", "cli")
  },
  externals: [
    "@ganache/filecoin",
    "bigint-buffer",
    "leveldown",
    "secp256k1",
    "keccak"
  ],
  plugins: [
    new webpack.BannerPlugin({ banner: "#!/usr/bin/env node", raw: true })
  ],
  module: {
    rules: [
      {
        // webpack load native modules
        test: /\.node$/,
        loader: "node-loader"
      },
      {
        test: /cli.ts$/,
        use: "shebang-loader"
      }
    ]
  }
});

export default config;
