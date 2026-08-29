module.exports = function (api) {
  api.cacheEverything();
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["."],
          alias: { "@": "." },
        },
      ],
    ],
  };
};
