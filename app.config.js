const { expo } = require('./app.json');
const pkg = require('./package.json');

module.exports = () => ({
  ...expo,
  name: 'OrionTV Danmaku Dev',
  version: pkg.version,
  orientation: 'landscape',
  scheme: 'oriontv-danmaku',
  android: {
    ...expo.android,
    package: 'com.oriontv.danmaku.dev',
    versionCode: Number(process.env.ORION_BUILD_NUMBER || 1),
  },
  extra: { ...expo.extra, danmakuBuild: process.env.ORION_BUILD_NUMBER || 'local', danmakuBuiltAt: process.env.ORION_BUILD_TIME || 'local', danmakuCommit: (process.env.GITHUB_SHA || 'local').slice(0,8) },
});
