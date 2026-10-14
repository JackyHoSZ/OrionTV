# Android TV 构建与验收

## 环境与分支

使用 GitHub Actions 的 Ubuntu 运行器、Node 18、JDK 17，复用官方 Expo prebuild 和 Gradle assembleRelease 流程。Mac 只运行 Node 检查，不安装 Android SDK、模拟器、Java 或 Gradle。

工作流 `.github/workflows/danmaku-dev.yml` 在开发分支运行，不创建或覆盖官方 Release。

## 阶段 A

- 独立包名 `com.oriontv.danmaku.dev`，可与官方 OrionTV 并存。
- CI 自动生成 60 秒测试图视频，不需要第三方影片或真实用户凭据。
- Android TV API 29 / x86 AVD 自动安装自包含 APK，通过深链接打开测试页。
- 用遥控器确认键暂停/恢复，右键移动后确认快进，记录原生实际播放时间。
- 保存截图、UI XML、logcat、JSON 结果到 Actions Artifact；截图需检查弹幕确实位于视频上方。
- 模拟器验证反映虚拟设备效果，不能证明当贝 D5X 的硬件解码帧率或性能。

## 当前证据

- 基线类型检查和 50 个原有单元测试通过；修复了测试数据类型和过期暗色主题快照。
- VPS 自动匹配庆余年第二季第 2 集：HTTP 200；腾讯弹幕 40,058 条，时长 2,730 秒。
- MoonTVPlus 登录、服务器配置、播放源列表接口 HTTP 200。查询单源的“庆余年第二季”返回未找到结果，不能解释为接口不存在；“三体”单源查询 HTTP 200，提供 2022/2023 两个作品和真实集标签。
- 云端原生构建及 AVD 覆盖验证仍在进行。后续阶段须以真实运行结果更新此文档。

## 真机验收（待最终 APK）

将用户版 APK 传至 U 盘或当贝文件传输工具，安装后配置 MoonTVPlus 地址及账号、弹幕服务器及普通 Token。检查播放、暂停、倍速、快进快退、手动/自动切集、换源、手动弹幕来源、遥控器焦点和设置持久化。

未完成真机验收之前，不标记 D5X 正常。日志应只包含错误代码、状态和耗时，不能包含完整 Token、Cookie 或 Authorization。
