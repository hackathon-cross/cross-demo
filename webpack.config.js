const path = require('path')

module.exports = {
  target: 'web',
  mode: 'production',
  entry: {
    cross_chain_type: './src/cross_chain_type.js',
    cross_chain_lock: './src/cross_chain_lock.js',
  },
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /node_modules/,
      use: {
        loader: "babel-loader",
        options: {
          presets: ["@babel/preset-env"]
        }
      }
    }]
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'build'),
    libraryTarget: 'umd',
    library: 'Molecule',
    globalObject: 'this',
  },
}
