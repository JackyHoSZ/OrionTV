# Android TV 外部弹幕

开发分支：`feature/android-tv-danmaku`。基线：OrionTV `41c7a600` / 1.3.14。

## 开发前核实

- 保留 Expo SDK 51、React Native TVOS 0.74.2、Expo AV 14.0.7。
- `app/play.tsx` 使用 Expo AV `Video`；`useVideoHandlers` 接收原生 `AVPlaybackStatus`，位置和时长单位为毫秒。
- Android Expo AV 实现为 `VideoTextureView`，不是置顶 SurfaceView。原控制栏作为视频后的 React Native View 叠加。
- `playerStore` 保存暂停、缓冲、倍速、播放进度和当前集序号；`detailStore` 保存片名、年份和当前播放源。
- MoonTVPlus `/api/search/one` 实际提供 `episodes_titles`，必须优先使用真实标签，不能仅凭数组序号假设集号。
- 后端连接通过原 `services/api.ts`，弹幕使用独立服务模块。正式 MoonTVPlus、D1 和 VPS 配置不做修改。
- Stage A 的 `danmaku-test` 入口仅 CI 编译开关开启，使用自行生成的视频和模拟文本；发布给用户的 APK 不开启该入口。

## API 协议

`POST /api/v2/match` 只使用 `{fileName}`，响应为 `success/isMatched/matches`。
搜索为 `/search/anime?keyword=`；详情为 `/bangumi/{bangumiId或animeId}`；逐集搜索为 `/search/episodes?anime=`；弹幕为 `/comment/{episodeId}?format=json&duration=true`。

普通 Token 是 URL 路径中的一个片段。服务模块接受主机、主机/Token、主机/Token/api/v2，并避免重复追加同一个 Token。禁止填入 ADMIN_TOKEN。

弹幕 JSON 为 `{comments:[{cid,p,m,t}],videoDuration,count}`。`p` 包含秒数、模式及十进制 RGB；模式 1 滚动、5 顶部、4 底部。规范化结构为 `{id,time,text,color,mode}`，按秒排序。无效时间、空内容和不支持的模式丢弃。

45 秒超时；网络或 502/503/504 最多重试一次；401/403、异常 JSON 不重试。取消的订阅不影响仍在使用同一请求的其他订阅；所有订阅取消后中断底层请求。会话缓存最多 8 项、10 分钟。错误提示不含 URL、Token 或原始响应。

## 自动匹配与身份

优先调用 danmu_api 匹配机制；客户端校验作品名称、明确年份、明确季数和精确集号。第 1 集和第 10 集区分；特别篇和合并集要求手动选择。多个可靠候选不默认选第一项。

影视/季集身份独立于播放源身份。手动匹配按影视和季集保存，时间偏移按播放源分别保存，避免换源后的时间轴错用。

## 时间轴与密度

使用原生视频时间，毫秒转为秒。时间偏移正值延后弹幕。快进/倒退重置游标并二分查找当前位置，已过去的弹幕不重新补播；切集/换源取消旧请求并清空活动池。

每秒上限提供 1、2、4 和不限制。每个视频时间秒内均匀抽样，避免只保留最早几条。同屏数量是独立硬限制。默认 2 条/秒、4 条同屏、上方 50%、75% 不透明度、8 秒滚动、26 DIP 字号、10 秒重复过滤窗口。

实际 Android TV 覆盖层与完整设置仍按阶段验证；最终结果见 `ANDROID_TV_TEST.md`，构建通过不代表当贝 D5X 真机通过。
# 开发架构与安全边界

基础版本：OrionTV 1.3.14，官方提交 `41c7a6005985e5543b9bf302cdd4233d82f1ead5`。开发分支 `feature/android-tv-danmaku`，保留 upstream。沿用 Expo 51、React Native TV 0.74 和 Expo AV 14，不升级播放器内核。

## 模块

`services/danmaku/api.ts` 负责独立 HTTP 客户端与数据解析；`matching.ts` 负责保守的季集识别；`media.ts` 将后端元数据映射为影视身份；`timeline.ts` 预计算密度、二分定位与有限轨道调度；`storage.ts` 保存连接、显示配置与手动映射；`stores/danmakuStore.ts` 管理异步加载和取消；`components/danmaku/DanmakuOverlay.tsx` 通过原生驱动的 Animated.Text 绘制有限活动池。

当前完整 UI 与原播放器集成必须等待阶段 A/B 原生验证通过。此文档中的架构与模块测试不等于全部用户功能已交付。

## API

支持服务器根地址、带普通 TOKEN 的根地址和完整 `/api/v2` 根地址。Token 单独填写时避免重复拼接。查询 Token 使用路径鉴权，不使用 ADMIN_TOKEN，不携带 MoonTVPlus 的 Cookie。

- POST `/match`：JSON `{fileName}`；验证 `isMatched` 与 `matches`。
- GET `/search/anime?keyword=...`：返回作品列表及来源。
- GET `/search/episodes?anime=...`：接口能力另行提供。
- GET `/bangumi/:id`：选择作品后的集列表。
- GET `/comment/:id?format=json&duration=true`：读取弹幕与视频时长。

规范化评论为 `{id, time, text, color, mode}`；time 使用秒，mode 为 scroll/top/bottom。`p` 字段的 1/4/5 模式分别对应滚动、底部、顶部。过滤异常时间、空文本、超过 300 字的文本和不支持模式。单响应最多解析 150,000 条。

每次请求 45 秒超时；网络失败或 502/503/504 重试一次。401/403、格式错误和异常 JSON 不反复重试。同请求共享在途结果，各消费者独立取消；所有消费者退出后取消底层请求。会话缓存 10 分钟、最多 8 项、总原始评论不超过 100,000 条。API 故障只影响弹幕状态，不触发退出登录或视频换源。

## 匹配与身份

优先使用 danmu_api 的 fileName 匹配，附加实际年份与 SxxExx。读取真实集标题，不能简单把数组第 1 项当作第 1 集；特别篇与合并集不能虚构普通集号。名称/年份/季数/集数不一致或多个可信结果时要求手动选择。已知视频与弹幕时长差异超过 20% 时要求手动确认。

手动映射按影视名称、年份、电影/剧集、季集身份保存；播放源另作身份，用于保存源特有的时间偏移。服务端 ID 重启后可能变动，复播时按原作品来源和集标题重新解析，不能盲目复用旧 ID。切集、换源、退出时取消旧请求，过期结果不更新新视频。

## 时间与密度

实际 Expo AV `positionMillis / 1000` 是时钟来源；isPlaying/isBuffering/rate 来自原生状态。正偏移延迟弹幕，负偏移提前。暂停、缓冲停止动画；恢复按当前视频时间重新定位。跳转时清空活动池并二分定位新时间，不补发过去的评论。

每个视频秒内按等距分位抽样，支持 1/2/4 条与不限；不限仍受独立同屏上限控制。重复文本在 10 秒视频窗口内过滤。独占轨道防止追尾，活动池最多为配置上限，不逐帧扫描全部历史。字号 26 DIP、滚动持续 8 视频秒、透明度 75%、顶部 50% 区域、同屏 4 条、2 条/秒为默认值。

## 存储与限制

服务器地址和普通 Token 一同保存在 Android SecureStore，防止含 Token 的完整 URL 落入普通配置。显示设置和最多 200 项映射/偏移使用独立 AsyncStorage 命名空间，不修改原有观看记录。APK 不含真实 Token，日志只使用固定错误代码与无敏感信息的提示。

直接客户端必须持有查询 Token；设备被 root、调试或抓包时无法达到服务端密钥的保密级别。安全存储不改变这一边界。不要填入管理 Token。自定义 HTTP 地址为兼容私有服务提供，但正式部署建议使用 HTTPS。

模拟器测试不能证明当贝 D5X 的硬件解码性能。旧 Android 的媒体解码器、系统字体和遥控器实现仍需真机验收。官方自动更新与独立测试签名须隔离处理，避免官方 APK 覆盖此分支功能。
