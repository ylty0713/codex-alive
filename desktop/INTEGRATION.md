# Codex 桌面伙伴接入

v0.3.1：视频对话提示词改为凛的第一人称观察；明确摄像头画面由程序采集，避免称为用户上传的图片。默认一到两句口语，仅在被问到能力时解释逐轮画面的限制；没有新画面时不依据旧帧声称正在看用户。独立聊天子进程使用 model_reasoning_effort="low"，并停用聊天不需要的 node_repl MCP 服务以避开其启动等待，不修改用户全局配置；实际端到端延迟仍包括 CLI 启动、服务等待与语音合成。配置参考：https://developers.openai.com/codex/config-reference/ 。

v0.3.0：新增「感知与视频对话」。每次启动摄像头和麦克风默认关闭；用户在面板开启后才访问设备。Ctrl+Alt+R 打开面板。开启视频对话后说“凛”，再说问题；15 秒内停顿提交本次话语与一张当前 JPEG 快照。Codex CLI 的等待时间可能达到几十秒或更久，这一版不是连续视频流或低延迟全双工通话。回复播放期间暂停识别，避免自我唤醒；可以使用“直接说一句”停止播放并重新输入。

本地 Vosk 0.3.45 / vosk-model-small-cn-0.22 识别中文；独立的小词表识别器用于“凛 / lín”声学唤醒，普通转写可能将名字写成同音字。单音节唤醒在噪声和相近发音下可能误触发或漏检，可使用手动说话按钮。来源 https://alphacephei.com/vosk/models 。

摄像头预览使用镜像显示。face-api 1.7.15 的 tiny detector、68 点 landmarks 与 descriptor 在本机计算；支持不跟随、偶尔注视和持续跟随。人物档案只在本人勾选同意并登记后保存；使用 Electron safeStorage 加密名字与特征，支持逐个删除，不保存登记照片。多人和低置信度时不报姓名；相似度匹配有误差，不能用于身份认证。档案不随视频请求发送。项目来源 https://github.com/vladmandic/face-api （上游已归档）。

快照临时文件在 Codex 子进程退出后删除；已发送的图片遵循 Codex 本身的会话存储行为。关闭视频对话即停止发送新画面，已发出的请求可通过原有停止按钮取消。

默认女声改为晓伊，语速 -6%。口型采用在线语音 WordBoundary 时间、拼音近似发音和实际音量，增加闭唇、圆唇和嘴角变化并减少张嘴幅度；仍不是逐音素的精确对齐。人名“凛”的合成输入使用同音“林”纠正读音，显示文字保持原样。

验证：scripts/verify-presence.cjs 检查虚拟人物图片检测、加密档案授权/增删、模拟设备启停、真实 TTS 音频经过本地识别与声学唤醒；scripts/verify-video.cjs 将测试图片经原生 IPC 送入实际 Codex 并检查回答；scripts/verify-progress-speech.cjs 检查公开进度连续朗读、隐藏面板播放和壁纸口型同步。没有用用户真实摄像头或声音完成这些测试。

v0.2.2：兼容本机消息的 phase=commentary/final_answer（同时兼容旧 channel）。每条公开进度与最终回答进入串行语音队列，用消息 id 去重；分析、工具输出和隐藏推理不朗读。关闭面板后继续播放。新版默认使用晓晓神经女声，也可选择晓伊或本机慧慧。

自然语音通过 edge-tts 7.2.8 调用微软 Edge 在线语音服务，朗读正文发送给该服务，需联网。默认语速 -3%，不克隆真实人物声音。Python 运行时使用本机 Codex bundled runtime，依赖随桌面包放在 desktop/tts-deps。自然语音失败会明确显示错误，可选择本机音色继续。此接口为第三方开源客户端依赖，远程服务发生变化时可能需维护。参考 https://github.com/rany2/edge-tts 。

验证脚本 scripts/verify-progress-speech.cjs 使用本机真实消息结构，通过追加日志触发实际观察器、语音合成、隐藏面板播放和壁纸口型同步，检查连续播放顺序与消息去重。

画面设置：面板顶部可选择显示器，调节相机位置、观察目标、视野以及三盏光源的位置与亮度。拖动相机也会保存。设置保存在 Electron userData/scene-settings.json，实时同步至壁纸；显示器断开时回到主屏。显示器编号为应用枚举顺序，附带名称、尺寸与主屏标记便于辨认。

多屏验证：本机左侧竖屏物理范围 (-1440,0,1440,2560)、主屏 (0,0,1920,1080) 均已验证；通过 DIP 到物理像素转换和父窗口坐标映射定位，避免铺满整个虚拟桌面。测试见 scripts/verify-scene-settings.cjs 与 test-results/scene-settings.json。

当前任务由 companion-config.json 指定，读取本地会话新增事件，映射处理状态与最终回答；不读取并展示推理内容。此会话日志观察器是本地兼容适配，并非稳定的公开订阅 API。任务存档、迁移或日志格式变化时，需要重新连接。

面板聊天通过官方 codex exec --json 与 exec resume 接入，沿用本机已登录的 ChatGPT 凭证。聊天使用独立会话，当前应用生命周期内保留上下文。该入口设为只读聊天，不授予自动修改项目的权限。不会注入或恢复正在运行的桌面任务。

官方参考：https://developers.openai.com/codex/noninteractive/

思考状态对应待机与轻微转头，最终回答显示字幕并使用本地 Windows 语音朗读，口型来自实际音频振幅。不是精确的音素口型。面板可关闭自动朗读、停止语音和停止面板发起的请求；不会停止原 Codex 桌面任务。

壁纸挂到 Windows Explorer WorkerW，鼠标穿透。Ctrl+Alt+R 打开面板，Ctrl+Alt+Q 退出壁纸。壁纸启用时关闭面板会隐藏到托盘；从托盘退出可终止应用。

运行副本 character-runtime.glb：约 30 MB，101 根骨骼，52 个基础表情，贴图最长边 1024。原始 169 MB 模型保留在 character.glb。壁纸目标刷新上限约 30 FPS。

验证记录：test-results/codex-bridge.json（真实 Codex 回答）；test-results/companion-desktop.json（原生桌面挂载、口型 IPC、本地语音）；previews/companion-wallpaper.png（壁纸窗口渲染）。runtime-status.json 记录最近一次实际挂载的进程与宿主句柄，不作为永久在线证明。
