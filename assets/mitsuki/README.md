# Mitsuki / Genesis 9 导入工程

## 使用现成资源的第一版（v02）

打开 `mitsuki_starter_v02.blend`：Mitsuki 角色配 Genesis 9 Starter Essentials 自带的 Pixie 短发、Base Shirt 和 Base Shorts。头发、衣服和身体仍为独立对象，贴图已打包。短发转换了源文件的 21,755 条发丝，使用棕色 Blender 材质。上衣、短裤通过基础变形转移和表面间距修改器适配身体。相机视角已设好，可按小键盘 0 切换，按 F12 渲染。

这是源资源的初步试穿版。dForce 动态和 Iray 材质未原样转换，衣服目前较贴身；尚未完成极端姿势、布料碰撞或实时性能检查。无需继续按凛的造型改制即可作为后续第一版基础。

生成脚本 `modeling/add_starter_wardrobe.py`，资源统计 `starter-wardrobe-report.json`，真实渲染 `previews/mitsuki_starter_outfit.png`。

## 原始导入工程（v01）

`mitsuki_source_v01.blend` 是来自本地 DAZ 素材的可编辑基础分辨率转换工程，使用 Blender 5.2.1 生成。贴图已打包。它不是最终的凛，也未替换桌面程序当前模型。

## 已转换

- 身体 25,182 个顶点、眼睛 2,120 个、嘴部 5,079 个、睫毛 2,028 个。
- 四个独立网格，共用 143 根骨骼，保留源蒙皮权重。
- 身体的 Mitsuki Body、Mitsuki Head 形态键，以及眼睛、嘴部和睫毛的对应头部形态键。
- UV 接缝及分材质贴图；身体 UDIM 按材质转换为单张贴图坐标。
- 独立的 `10_WARDROBE` 集合，当前只有临时遮挡衣片，尚未完成学院风服装。

身体形态键保持为 1 时骨骼处于 Mitsuki 对应的静止位置。调整这些形态键之后，需要同步调整骨骼；当前没有自动 ERC 联动。

## 验证及限制

`validation.json` 记录重新打开工程后的静止姿态网格误差、头部/手臂转动和贴图打包检查。检查不代表完整动画验收。

源蒙皮中部分脚部顶点存在约 0.0013 的上臂权重，15 度抬臂测试产生约 0.4 毫米脚部位移。导入保留原权重，正式动作绑定前需要清理。

未转换 DHDM 高清细节、Iray 专有着色、DAZ ERC/JCM 驱动及原生旋转约定。现有骨架可进行基础 FK 编辑，但尚未制作 IK、口型和生产级动作。眼睛当前使用素材包的蓝色 Daily Eyes 贴图。

下一阶段需要进行凛的二次元脸型调整、红棕色大眼睛、玫瑰红长发与白蝴蝶结制作，以及独立学院风服装适配。现成素材包未包含这些头发或服装。

生成脚本：`modeling/import_mitsuki.py`；检查脚本：`modeling/validate_mitsuki.py`。重新运行生成脚本会覆盖本版本，手工修改前请另存版本。
