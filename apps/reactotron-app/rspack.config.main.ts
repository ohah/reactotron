import { defineConfig } from "@rspack/cli";
import { rspack } from '@rspack/core';
import path from 'node:path';

const optionalPlugins: any[] = [];
if (process.platform !== 'darwin') {
  optionalPlugins.push(
    new rspack.IgnorePlugin({ resourceRegExp: /^fsevents$/ }),
  );
  optionalPlugins.push(
    new rspack.IgnorePlugin({ resourceRegExp: /^dmg-builder$/ }),
  );
}
optionalPlugins.push(
  new rspack.IgnorePlugin({ resourceRegExp: /^osx-temperature-sensor$/ }),
);

export default defineConfig((env) => {
  console.log('env', env)
  return {
    mode: process.env.NODE_ENV === 'development'? 'development' : 'production',
    target: 'electron-main',
    entry: {
      main: path.join(__dirname, './src/main/index.ts'),
      // preload: path.join(__dirname, './src/main/preload.ts'),
    },
    output: {
      path: path.join(__dirname, './dist/main'),
      filename: '[name].js',
      library: {
        type: 'commonjs2',
      },
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    },
    externals: [
      'electron',
      'webpack',
      'electron-devtools-installer',
      'webpack/hot/log-apply-result',
      'electron-webpack/out/electron-main-hmr/HmrClient',
      'source-map-support/source-map-support.js',
      // Node.js 내장 모듈들
      'fs',
      'path',
      'crypto',
      'stream',
      'buffer',
      'util',
      'assert',
      'url',
      'os',
      'http',
      'https',
      'zlib',
      'constants',
      'timers',
      'process',
    ],
    module: {
      rules: [
        {
          test: /\.(ts|tsx|js|jsx)$/,
          exclude: [/[\\/]node_modules[\\/]/],
          loader: 'builtin:swc-loader',
          /** @type {import('@rspack/core').SwcLoaderOptions} */
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
                decorators: false,
                dynamicImport: true,
              },
            },
          },
        },
        {
          test: /\.(png|jpe?g|gif)$/i,
          type: 'asset/resource',
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
        },
        {
          test: /\.jfif$/,
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
          },
        },
        {
          test: /\.mp3$/,
          use: 'file-loader',
        },
        {
          test: /\.svg$/,
          use: ['@svgr/webpack', 'url-loader'],
        },
        {
          test: /\.css$/i,
          type: 'css',
        },
      ],
    },
    watchOptions: {
      ignored: /node_modules/,
    },
    plugins: [
      ...optionalPlugins,
    ],
  }
})
