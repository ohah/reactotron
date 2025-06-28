import { rspack } from "@rspack/core"
import { defineConfig } from "@rspack/cli"
import type { SwcLoaderOptions } from "@rspack/core"
import path from "node:path"
import ReactRefreshRspackPlugin from '@rspack/plugin-react-refresh';

export default defineConfig((env) => {
  const isDevelopment = env.NODE_ENV === "development" || !!env?.RSPACK_SERVE;
  
  return {
    mode: isDevelopment ? "development" : "production",
    devtool: "source-map",
    plugins: [
      new rspack.HtmlRspackPlugin({
        template: path.join(__dirname, "./public/index.html"),
        minify: false,
      }),
      new rspack.ProvidePlugin({
        process: "process/browser",
        Buffer: ["buffer", "Buffer"],
      }),
      new rspack.ProvidePlugin({
        React: "react",
      }),
      // TODO
      env.RSPACK_SERVE && new ReactRefreshRspackPlugin({
        overlay: true,
        forceEnable: false,
        exclude: /.css.ts/,
      }),
    ].filter(Boolean),
    target: ["web", "electron-renderer"],
    experiments: {
      css: true,
    },
    entry: {
      renderer: path.join(__dirname, "./src/renderer/index.tsx"),
    },
    output: {
      filename: "[name].bundle.js",
      path: path.join(__dirname, "./dist"),
    },
    devServer: {
      static: path.join(__dirname, "./dist/renderer"),
      port: 3333,
      hot: false,
      liveReload: true,
    },
    resolve: {
      modules: [
        "node_modules",
        path.resolve(__dirname, "../../node_modules"), // Root node_modules
        path.resolve(__dirname, "./node_modules"), // App node_modules
      ],
      tsConfig: path.resolve(__dirname, "./tsconfig.json"),
      extensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx|ts|tsx)$/,
          exclude: [/[\\/]node_modules[\\/]/],
          loader: "builtin:swc-loader",
          options: {
            jsc: {
              parser: {
                syntax: "typescript",
                tsx: true,
              },
              transform: {
                react: {
                  throwIfNamespace: false,
                  development: !!env?.RSPACK_SERVE,
                  refresh: !!env?.RSPACK_SERVE,
                  useBuiltins: false,
                  runtime: "automatic",
                },
              },
            },
          } as SwcLoaderOptions,
        },
        {
          test: /\.(png|jpe?g|gif)$/i,
          type: "asset/resource",
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: "asset/resource",
        },
        {
          test: /\.jfif$/,
          loader: "file-loader",
          options: {
            name: "[name].[ext]",
          },
        },
        {
          test: /\.mp3$/,
          use: "file-loader",
        },
        {
          test: /\.svg$/,
          use: ["@svgr/webpack", "url-loader"],
        },
        {
          test: /\.css$/i,
          type: "css",
        },
      ],
    },
  }
})
