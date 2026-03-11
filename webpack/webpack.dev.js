/* eslint-disable import/no-extraneous-dependencies */

const path = require('path');

const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = env => console.info(env) || merge(common, {
  mode: env.NODE_ENV,
  output: {
    filename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.s?css$/,
        use: [
          'style-loader',
          'css-loader',
          { loader: 'sass-loader', options: { implementation: require('sass') } },
        ],
      },
    ],
  },
  devServer: {
    compress: true,
    port: env.PORT,
    devMiddleware: { writeToDisk: true },
    static: { directory: path.join(__dirname, '..', 'dist') },
    historyApiFallback: { disableDotRule: true },
    proxy: [{ context: ['/data'], target: 'http://localhost:2700' }],
  },
});
