const webpack = require("webpack");

module.exports = function override(config) {
  // Bỏ lỗi fullySpecified với .mjs
  config.module.rules.push({
    test: /\.mjs$/,
    type: "javascript/auto",
    resolve: {
      fullySpecified: false,
    },
  });

  // Thêm fallback và ProvidePlugin
  config.resolve.fallback = {
    ...config.resolve.fallback,
    process: require.resolve("process/browser"),
    stream: require.resolve("stream-browserify"),
    zlib: require.resolve("browserify-zlib"),
    util: require.resolve("util"),
    buffer: require.resolve("buffer"),
    assert: require.resolve("assert"),
    crypto: require.resolve("crypto-browserify"),
    path: require.resolve("path-browserify"),
  };

  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: "process/browser",
      Buffer: ["buffer", "Buffer"],
    }),
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(
        process.env.NODE_ENV || "development"
      ),
      "process.env.REACT_APP_API_URL": JSON.stringify(
        process.env.REACT_APP_API_URL || "http://localhost:8081"
      ),
      "process.env.REACT_APP_SOCKET_URL": JSON.stringify(
        process.env.REACT_APP_SOCKET_URL || "http://localhost:9092"
      ),
    }),
  ];

  return config;
};
