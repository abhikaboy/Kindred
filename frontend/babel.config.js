module.exports = function (api) {
  // api.env() also keys Babel's cache on the environment
  const isProduction = api.env('production');
  return {
    presets: ['babel-preset-expo'],
    plugins: isProduction
      ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
      : [],
  };
};
