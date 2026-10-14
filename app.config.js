const { expo } = require('./app.json');

module.exports = () => ({
  ...expo,
  name: 'OrionTV Danmaku Dev',
  version: '1.3.14',
  orientation: 'landscape',
  scheme: 'oriontv-danmaku',
  android: {
    ...expo.android,
    package: 'com.oriontv.danmaku.dev',
    versionCode: Number(process.env.ORION_BUILD_NUMBER || 1),
  },
  extra: { ...expo.extra, danmakuBuild: process.env.ORION_BUILD_NUMBER || 'local' },
});
