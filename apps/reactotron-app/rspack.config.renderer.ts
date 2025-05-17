import { rspack } from "@rspack/core";
import { defineConfig } from "@rspack/cli";
import type { SwcLoaderOptions } from "@rspack/core";
import path from 'node:path';
// import ReactRefreshRspackPlugin from '@rspack/plugin-react-refresh';

export default defineConfig((env) => {
  console.log('env', env)
  console.log(`path.resolve(__dirname, '../../node_modules/reactotron-core-server')`, path.resolve(__dirname, '../../node_modules/reactotron-core-server'))
  return {
    mode: env.NODE_ENV === 'development' ? 'development' : 'production',
    devtool: 'source-map',
    plugins: [
      new rspack.HtmlRspackPlugin({
        template: path.join(__dirname, './public/index.html'),
        minify: false,
      }),
      new rspack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer'],
        https: 'https-browserify',  // https polyfill 추가
      }),
      new rspack.ProvidePlugin({
        React: 'react',
      }),
      // env.RSPACK_SERVE && new ReactRefreshRspackPlugin({
      //   overlay: false,
      //   forceEnable: true,
      //   exclude: /.css.ts/,
      // }),
    ].filter(Boolean),
    target: ['web', 'electron-renderer'],
    experiments: {
      css: true,
    },
    entry: {
      renderer: path.join(__dirname, './src/renderer/index.tsx'),
    },
    output: {
      filename: '[name].bundle.js',
      path: path.join(__dirname, './dist/renderer'),
    },
    devServer: {
      static: path.join(__dirname, './dist/renderer'),
      port: 3333,
      hot: false,
      liveReload: false,
    },
    node: {
      __dirname: true,
      __filename: true,
      global: true,
    },
    externals: [
      'electron',
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
    resolve: {
      fallback: {
        fs: false,  // 실제 Node.js fs 모듈 사용
        path: false,  // 실제 Node.js path 모듈 사용
        crypto: false,  // 실제 Node.js crypto 모듈 사용
        stream: false,  // 실제 Node.js stream 모듈 사용
        buffer: false,  // 실제 Node.js buffer 모듈 사용
        util: false,  // 실제 Node.js util 모듈 사용
        assert: false,  // 실제 Node.js assert 모듈 사용
        url: false,  // 실제 Node.js url 모듈 사용
        os: false,  // 실제 Node.js os 모듈 사용
        http: false,  // 실제 Node.js http 모듈 사용
        https: require.resolve('https-browserify'),  // https polyfill 추가
        zlib: false,  // 실제 Node.js zlib 모듈 사용
        constants: false,  // 실제 Node.js constants 모듈 사용
        timers: false,  // 실제 Node.js timers 모듈 사용
        process: false,  // 실제 Node.js process 모듈 사용
      },
      modules: [
        'node_modules',
        path.resolve(__dirname, '../../node_modules'),  // 루트 node_modules
        path.resolve(__dirname, './node_modules'),     // 앱 node_modules
      ],
      tsConfig: path.resolve(__dirname, './tsconfig.json'),
      extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    },
    module: {
      rules: [
        // https://github.com/react-dnd/react-dnd/issues/3425
        {
          test: /\.m?js$/,
          resolve: {
            fullySpecified: false,
          },
        },
        {
          test: /\.(js|jsx|ts|tsx)$/,
          exclude: [/[\\/]node_modules[\\/]/],
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: true,
              },
              transform: {
                react: {
                  throwIfNamespace: false,
                  development: false,
                  refresh: false,
                  useSpread: false,
                  useBuiltins: false,
                  runtime: 'automatic',
                },
              },
            },
          } as SwcLoaderOptions,
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
  };
});
