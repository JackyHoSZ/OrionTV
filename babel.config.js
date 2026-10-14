module.exports = function (api) {
  api.cache(true);
  
  const plugins = [];
  
  // 在生产环境移除console调用以优化性能
  if (process.env.NODE_ENV === 'production' && process.env.EXPO_PUBLIC_DANMAKU_E2E !== '1') {
    plugins.push('transform-remove-console');
  }
  
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};