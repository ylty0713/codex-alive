# 导入角色 · 原型 01

来源：D:/BaiduNetdiskDownload/companion-character（52bs）.glb；原文件保留不变，character.glb 为项目副本。
动作来源：D:/BaiduNetdiskDownload/动作/idle.Fbx 与 talk.Fbx。

运行：项目根目录执行 node scripts/preview-server.mjs，打开 http://127.0.0.1:4317/modeling/companion.html 。

本版沿用用户提供的写实角色外观。包含 101 根已有骨骼、188 个面部形变，约 10.9 万渲染三角形。无需重新绑定。

完成：GLB 与原始内嵌材质载入、比例和地面校准、原动作转换、FBX/glTF 父级坐标差异修正、待机与交谈交叉淡化、旋转查看、转头叠加、自然眨眼、微笑和张嘴控制、系统语音朗读入口。

语音口型仅为程序近似开合，不是音素对齐。未接入智能体，尚未将新模型替换到原桌面壁纸宿主中；没有新增行走动作。写实材质在浏览器中的效果为实时近似。

验证：node scripts/verify-companion.cjs。检查真实浏览器加载、两段动画、面部参数、站立方向和脚本错误，并保存全身、面部及交谈截图到 previews。系统语音是否发声仍需在交互浏览器确认，本自动化验证不将其记为已验证。

转换脚本：modeling/convert_companion_actions.py；页面：modeling/companion.html 与 companion.js。
