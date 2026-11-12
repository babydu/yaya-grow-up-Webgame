# Requirements Document: 配饰染色变体

## Introduction

为已有的 16 件配饰增加零新素材的染色变体：玩家在背包页为任一配饰选择 3 档色相方案（本色 / 暖调 +30° / 冷调 +200°），房间场景中的穿戴/摆放渲染即时应用 CSS 色相偏移滤镜。染色结果入库持久化，作为纯外观玩法，不改变配饰位置、尺寸与数值效果。

## Glossary

- **染色方案 (variant)**：作用于单件配饰的色相偏移档位，0 为本色，1 为暖调（+30°），2 为冷调（+200°）。
- **色相偏移**：渲染层对配饰图片应用 `filter: hue-rotate(Ndeg)` 的纯代码变色手段，不修改 PNG 与 WEAR_POS。
- **tints**：存档字段，`{ [配饰id]: variant }`，仅记录非 0 档；旧存档缺省为空对象。

## Requirements

### Requirement 1: 染色操作与校验

**User Story:** AS 玩家, I want 给背包里的配饰换色, so that 同一件配饰能搭配不同心情的房间。

#### Acceptance Criteria

1. WHERE 玩家拥有该配饰且染色方案为 0/1/2，THE 系统 SHALL 将存档 tints 中该配饰记录为所选方案。
2. WHERE 染色方案为 0（本色），THE 系统 SHALL 清除该配饰的 tint 记录。
3. IF 染色方案编号越界或商品不是配饰，THE 系统 SHALL 返回无效提示并保持 tints 不变。
4. WHERE 玩家执行染色，THE 系统 SHALL 不消耗积分与库存。
5. WHERE 玩家重复使用同一方案，THE 系统 SHALL 保持结果不变且返回成功。

### Requirement 2: 背包页染色入口

**User Story:** AS 玩家, I want 在背包页直接看到色点并点选, so that 染色是一步完成的操作。

#### Acceptance Criteria

1. WHILE 背包页展示配饰行，THE 系统 SHALL 为每件配饰渲染 3 个色点按钮并标注方案名称。
2. WHEN 玩家点击色点，THE 系统 SHALL 调用引擎染色并即时刷新该行选中态与房间场景。
3. WHERE 配饰已染色，THE 系统 SHALL 将对应色点标记为选中。

### Requirement 3: 场景渲染色相偏移

**User Story:** AS 玩家, I want 房间里看到染色后的效果, so that 搭配成果可见。

#### Acceptance Criteria

1. WHILE 穿戴或摆放的配饰存在非 0 方案，THE 系统 SHALL 在渲染该配饰图片时应用对应角度的 hue-rotate 滤镜。
2. WHILE 配饰为 0 方案或无记录，THE 系统 SHALL 保持原有渲染（无滤镜）。
3. WHERE 染色或穿脱发生，THE 系统 SHALL 使场景缓存键包含 tint，保证画面即时更新。

### Requirement 4: 存档兼容与持久化

**User Story:** AS 玩家, I want 染色关掉页面后还在, so that 搭配被长期记住。

#### Acceptance Criteria

1. IF 存档缺少 tints 字段，THE 系统 SHALL 以空对象载入并允许后续染色。
2. IF tints 包含不存在的配饰编号或越界方案，THE 系统 SHALL 拒绝载入该存档。
3. WHERE 染色后保存并重新载入，THE 系统 SHALL 保持每件配饰的方案不变。

## References

[^1]: (engine.js#L165) — accessoryFlavor 目录，16 件配饰的名称与形态描述
[^2]: (engine.js#L183) — ACC_SLOT 穿戴/摆放双槽定义
[^3]: (engine.js#L192) — normalizeWorn 既有迁移模式，tints 缺省处理参照它
[^4]: (visuals.js#L48) — WEAR_POS 配饰定位，染色仅加滤镜不改动定位
[^5]: (game.js#L179) — sceneKey 场景缓存键，需追加 tint 分量
