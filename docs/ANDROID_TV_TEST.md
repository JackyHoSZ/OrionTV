# 构建、测试与当贝 D5X 安装

## 版本与环境

开发分支 `feature/android-tv-danmaku`，独立包名 `com.oriontv.danmaku.dev`，可与官方 OrionTV 及 MoonTVPlus APK 并存。版本为 `package.json` 中的 `1.3.14-danmaku.1`；versionCode 使用此专用工作流的递增构建号。

Mac 仅运行 Node/Python/OpenSSL 和 GitHub CLI。Android SDK、JDK 17、Gradle、模拟器全部在 GitHub Actions 的 Ubuntu 运行器运行。沿用官方 Node 18、Expo prebuild、copy-config 和 Gradle assembleRelease 流程，不升级播放器。

## 云端构建

工作流为 `.github/workflows/danmaku-dev.yml`，不发布或覆盖官方 Release。

1. 推送到开发分支，自动执行类型、Lint、单元测试和调度基准。
2. 完整原生构建生成 x86 测试 APK；后续纯 JS 验证可复用已编译的同版本原生模块。
3. API29 / x86 / tv_1080p Android TV AVD 安装应用，通过真实原生 Video 播放自行生成的 H.264/AAC 测试图视频。
4. 测试服务器模拟匹配、作品/剧集与评论，通过 ADB 本地端口映射访问，不使用真实账号或 Token。
5. 自动发送 DPAD 按下/释放事件，读取原生可访问性状态，并保存截图、XML、JSON、logcat、内存信息和 API 操作摘要。
6. 推送提交含 `[delivery]` 时，只有原生运行测试成功才执行 ARM32+ARM64 交付构建。工作流已注册后也可通过 GitHub CLI 对本分支触发 `build_apk=true`；网页 Run workflow 按钮通常要求工作流先进入默认分支，不能保证本开发分支直接显示此按钮。
7. `OrionTV-Danmaku-ARM-构建号` Artifact 包含 APK、metadata.json、SHA256SUMS、签名和 Manifest 验证信息。下载需要登录有仓库访问权限的 GitHub 账号。

更新构建可由 Codex 执行：

```sh
gh workflow run danmaku-dev.yml --repo JackyHoSZ/OrionTV --ref feature/android-tv-danmaku -f build_apk=true
```

若当前账号/界面不允许手动触发，推送包含 `[delivery]` 的提交即可，不必修改默认分支。有关分支与手动触发的要求见 [GitHub 官方说明](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)。纯 JS 的 `[overlay-retest]` 使用保留的原生基线 Artifact；到期或修改原生依赖后使用完整构建，不复用旧基线。

个人签名的 PKCS12 和密码保存在仓库 Actions Secrets：`ORION_SIGNING_P12`、`ORION_SIGNING_PASSWORD`。临时密钥在签名后删除，不进入 Git 或 Artifact。后续保持包名与签名不变，并递增 versionCode，即可覆盖升级。签名丢失或更换时不能保留数据直接覆盖安装。

## 已有实际证据

| 阶段 | 证据与状态 |
|---|---|
| A | [运行 38626200453](https://github.com/JackyHoSZ/OrionTV/actions/runs/38626200453) 成功：真实视频、三条覆盖、遥控器暂停/恢复/快进；暂停两次位置均 39103ms，覆盖坐标相同 |
| B | [运行 38638735218](https://github.com/JackyHoSZ/OrionTV/actions/runs/38638735218) 成功：原控制栏、原生 API 10000 条、暂停稳定、暂停时 ±10 秒、2 倍速、开关/保存、密度和切集；下一集实际 match=3、同屏≤4 |
| C | [运行 38646815556](https://github.com/JackyHoSZ/OrionTV/actions/runs/38646815556) 成功：完整面板、手动选集、单集/源偏移、焦点恢复、重启后复用映射、连接测试与自定义颜色 |
| D | [运行 38647907529](https://github.com/JackyHoSZ/OrionTV/actions/runs/38647907529) 的原生运行任务成功：122 项测试、四方向/Back/焦点恢复、1.25/1.5/2 倍速、换源独立偏移、HTTP503 下继续播放及恢复、自动下一集、电影自动匹配和真实 HLS 播放；100/1000/3000/10000 基准同屏始终≤4 |
| E | 签名交付构建由测试门槛控制；最终 Artifact 与大小待生成后补充 |

真实 VPS 只读验证：庆余年第二季第 2 集匹配成功，读取 40,058 条评论、2730 秒；电影“流浪地球(2019)”匹配成功。手动搜索返回四个来源，360 与腾讯作品列表均读取 36 个实际剧集。没有把真实查询 Token 上传到 CI。

真实 MoonTVPlus 只读验证：登录、server-config 与播放源接口 200，StorageType=d1，69 个源；“三体”单源查询返回实际集标题。没有改动源配置、管理员、数据库或正式观看记录。影视源某个片名无结果不能等同接口不兼容。

## 模拟器的实际限制

AVD 是软件渲染与虚拟解码环境，启动及可访问性读取会有明显延迟。日志曾显示预装商店后台更新及 dex2oat 占用资源；测试仅在一次性云端 AVD 内停用商店/GMS，以隔离干扰，也验证核心播放不依赖 Google Play。测试按键一次后在限定时间内等待结果，不反复按键来制造通过；超时或异常保留失败证据。跳过 SVG 内部非交互节点并刷新状态节点，只减少测试工具开销，不改变应用行为。

Node 基准的 heap 差值受 GC 影响，不是 Android 常驻内存；模拟器的 UI 帧统计也不代表 D5X 的硬件视频帧率。不用“编译成功”替代原生运行或真机结果。

原功能回归分层进行：真实站点登录/搜索接口与元数据协议通过只读检查；原记录恢复、集标题、倍速偏好和片尾切集经过单元测试；原控制栏/Video 的暂停、进度、倍速、切集与换源经过 AVD。实际站点账号在 D5X 的完整观看流程仍需真机验收。

## 当贝 D5X 安装

1. 下载交付 Artifact，解压得到 ARM APK；不要安装 x86/e2e 可行性测试 APK。
2. 用 U 盘、当贝文件传输或同一局域网文件传输将 APK 送到投影仪。
3. 在当贝文件管理器打开 APK；按系统提示允许此文件管理器安装未知来源应用。
4. 安装后从应用列表打开 **OrionTV Danmaku Dev**。官方 OrionTV 无需卸载。
5. 在原设置页将后端设为 `https://tv.vafa.eu.org`，登录自己的站点账号。
6. 打开“弹幕设置”，服务器填 `https://danmu.vafa.eu.org`，填写现有普通查询 Token，保存并测试连接。不要使用管理 Token。
7. 播放影片；默认自动加载、2 条/视频秒、4 条同屏、上方 50%、75% 不透明度。按确认/下键显示原控制栏，进入“弹幕设置”。

若系统提示签名不一致，先确认是否误装了其他签名的同包名测试 APK。正式交付使用固定个人签名；卸载会删除此包的本地设置与映射，不能随意卸载后宣称数据保留。

## D5X 真机验收清单

当前未连接 D5X，以下均不能宣称已通过：

- 实际站点账号登录保持、搜索、详情、播放线路、不同编码与真实 HLS/HTTPS 播放。
- 真实视频播放质量、音画同步、硬件解码、帧率、长时间温度与内存表现。
- 暂停、恢复、快进快退、1.25/1.5/2 倍速、缓冲、自动/手动切集、换源、退出重进、断点与观看记录。
- 系统电视键盘输入、上下左右/OK/Back、焦点高亮与面板关闭后的焦点恢复。
- 实际 VPS 普通 Token 连接、电影与多季剧匹配、手动换来源、偏移、原始颜色与固定类型。
- 重启应用/设备后连接、显示设置、手动映射与偏移继续有效。

请反馈片名、季集、源名、操作顺序及安全错误代码，不发送完整 Token、Cookie 或 Authorization。

## 日志、更新与回滚

无需为了安装而配置 Mac Android SDK。真机若已有其他电脑的 ADB，可由该设备运行 `adb logcat -c`，复现后导出 `adb logcat -d`；日志分享前检查敏感信息。普通用户也可先提供界面错误文字和截图。

更新：从本 Fork 的成功 Actions 下载同签名、构建号更高的 ARM APK直接覆盖安装。此分支关闭指向官方原版的自动更新检查，避免功能被原版覆盖。

维护：保留 `upstream`，需要同步时先 `git fetch upstream`，在开发分支合并 `upstream/master`，再执行完整检查和云端原生回归。不要同时升级 Expo/RN/AV 后把兼容问题归因于弹幕。

回滚：优先重新构建已知成功提交，使用同一签名且更高的 versionCode 发布。直接安装较低 versionCode 通常会被系统拒绝。需要卸载回滚时先记录连接和显示参数；卸载会丢失本地映射，正式后端数据不应被清空。
