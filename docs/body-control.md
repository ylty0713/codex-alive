# 身体控制（v0.4.6）

凛作为 Codex 的数字身体：每条公开反馈由语言与身体意图共同组成。项目中的 `AGENTS.md` 要求代理先写一次身体指令，再输出正常的进度或最终回答。

在仓库根目录执行：

```powershell
node scripts/body-intent.cjs <当前任务ID> nod softSmile user 0.3
```

动作支持 `none/nod/tilt/settle/wave/explain`，表情支持 `neutral/softSmile`，注视支持 `user/away`，强度范围为 0–0.7。多数反馈适合保持 `none`，避免手势重复。摄像头追踪开启时，实际追踪优先于默认注视。

本机指令按任务 ID 存放于 `%LOCALAPPDATA%/codex-alive/body-intents`，有效期两分钟。日志桥仅为对应任务的公开消息读取指令，指令与台词一同排队，到语音开始时同步至壁纸；语音过程中不随机插入手势。未收到指令时采用中性待机。关闭自动朗读时执行短暂身体表达并显示字幕。

面板聊天通过 `text/body` JSON 同时生成台词和动作，控制字段不播报。异常数据经过白名单和强度限制。停止按钮会清除当前动作与待播队列。

这不是全局 Codex 系统提示修改，也不意味着持续视觉或意识。新任务需加载本项目指令，且桌面桥需连接该任务。当前动作使用已存在的程序化姿态；尚未接入动作预览页里待用户筛选的舞蹈。

验证：`node --test tests/*.test.mjs`；开发环境的 `scripts/verify-progress-speech.cjs` 检查语音队列、动作开始时机、壁纸同步与去重。
