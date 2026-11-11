# Requirements Document — 设计包美术深度优化

## Introduction

基于设计工具导出的《养成物语角色形象设定集 v1.1》（4 角色 × 4 成长阶段 × 4 背景 × 16 饰物），对现有游戏的角色、背景、成长路径页与配饰系统做一次完整升级：接入第 4 可领养角色「小植物·团子」，房间场景改用整幅手绘背景与阶段角色立绘，成长路径页展示阶段美术，新增 16 件可购买、可穿戴的随身饰物。

## Glossary

- **设计包**: `/tmp/opencode/design-pack/` 内的美术资产与规范（bible HTML、stages、bg、acc）。
- **阶段立绘**: `stages/{type}-{1..4}.png`，每角色 4 张，对应引擎 stageIndex 0–3。
- **饰物**: `acc-*.png` 切出的 16 件随身饰物，归属各自角色类型。
- **穿戴**: 将已拥有的饰物叠加渲染在房间角色立绘上，同一时间最多穿戴 1 件。

## Requirements

### R1 四角色档案（含小植物）

**User Story:** AS 玩家, I want 在领养时能选择小植物·团子, so that 四种陪伴方式都可选。

#### Acceptance Criteria

1. WHEN 读取引擎档案表, THE 系统 SHALL 提供 baby·阿团、cat·橘汐、dog·麦芽、plant·团子 四个档案，且 kind 分别为 宝宝/小猫/小狗/小植物。
2. WHEN 玩家执行领养流程, THE 系统 SHALL 允许选择 plant 并走与现有类型一致的确认、赠送初级行资、日志流程。
3. WHEN 生成触摸回应、情绪文案、低需求提醒, THE 系统 SHALL 为 plant 提供独立文案且引用当前档案名（文案中 SHALL 避免硬编码旧角色名）。
4. IF 旧存档中 selected 为 baby/cat/dog, THEN THE 系统 SHALL 在不改类型的前提下沿用新名称展示。

### R2 每类型阶段命名

**User Story:** AS 玩家, I want 每个角色有贴合设定的阶段名称, so that 成长叙事有个性。

#### Acceptance Criteria

1. WHEN 计算阶段名, THE 系统 SHALL 按 baby[襁褓,坐立,学步,小小侠客]、cat[篮中小猫,毛球,铃铛少年,成年猫]、dog[篮中幼犬,毛球小狗,少年期,成年犬]、plant[破土,幼苗,含苞,盛放] 返回。
2. WHEN 渲染里程碑列表与阶段徽标, THE 系统 SHALL 使用上述每类型阶段名。
3. THE 系统 SHALL 保持阶段解锁条件（游戏年龄 + 经验阈值）与现版本一致。

### R3 植物照护语义

**User Story:** AS 团子的养育者, I want 照护动作与需求标签符合植物设定, so that 养育体验有代入感。

#### Acceptance Criteria

1. WHEN 生成照护选项, THE 系统 SHALL 按 plant 返回 浇水/擦叶除虫/晒太阳/施肥 四个动作名。
2. WHEN 渲染需求条, THE 系统 SHALL 为 plant 显示 水分/洁净/阳光/养分 标签，其余类型沿用现有标签。
3. THE 系统 SHALL 为 plant 提供浇水（免费、只补水分）、擦叶清洁品、晒太阳陪伴玩具、施肥消耗的花肥与营养组合。

### R4 场景美术接入

**User Story:** AS 玩家, I want 小屋呈现设计包的手绘背景与阶段立绘, so that 视觉与设定集一致。

#### Acceptance Criteria

1. WHEN 渲染房间场景, THE 系统 SHALL 以 bg-{type} 整幅图作背景，并在其上叠加当前阶段立绘（assets/stages/{type}-{stageIndex+1}）。
2. WHEN 角色阶段或类型变化, THE 系统 SHALL 重渲染场景（含立绘与背景）。
3. THE 系统 SHALL 保留呼吸动画、地影、爱心反馈与 data-character 测试锚点，并新增 data-stage 锚点。
4. WHEN 渲染领养卡片与伴侣徽章, THE 系统 SHALL 使用阶段一立绘。
5. IF 任一美术资源加载失败, THEN THE 场景 SHALL 仍保持可读（背景色兜底），且照护功能 SHALL 不受影响。

### R5 配饰商店

**User Story:** AS 玩家, I want 用积分在生活小铺兑换角色饰物, so that 换装成为长期目标。

#### Acceptance Criteria

1. THE 系统 SHALL 提供 16 件饰物商品（每类型 4 件），名称与描述来自设计包饰物清单。
2. WHEN 玩家购买饰物, THE 系统 SHALL 扣减积分、写入拥有记录（pack=1），并沿用积分不足拦截。
3. WHEN 渲染饰物商品卡, THE 系统 SHALL 显示饰物缩略图、库存、价格，并按 minStage 门控（阶段未到禁用并提示「成长后解锁」）。
4. THE 系统 SHALL 在商店提供「随身饰物」筛选类目。

### R6 配饰穿戴

**User Story:** AS 玩家, I want 给角色穿上已拥有的饰物, so that 小屋里的形象独一无二。

#### Acceptance Criteria

1. WHEN 玩家对已拥有且适龄的饰物点击穿戴, THE 系统 SHALL 记录穿戴状态并在房间立绘上叠加该饰物图。
2. WHEN 玩家再次点击同一饰物, THE 系统 SHALL 脱下（清空穿戴状态）。
3. WHEN 玩家穿戴另一件饰物, THE 系统 SHALL 自动替换为最新一件。
4. IF 饰物未拥有或未达 minStage, THEN THE 系统 SHALL 拒绝穿戴并提示原因。
5. WHEN 存档读写, THE 系统 SHALL 持久化穿戴状态，校验器 SHALL 验证其为空或属于当前类型的有效饰物 id。

### R7 成长路径页改版

**User Story:** AS 玩家, I want 在成长足迹看到每个阶段的立绘与名称, so that 成长有可期待的图鉴。

#### Acceptance Criteria

1. WHEN 渲染成长页里程碑, THE 系统 SHALL 为每个阶段卡展示对应阶段立绘缩略图与每类型阶段名。
2. THE 系统 SHALL 保留解锁条件描述与「已留下足迹/慢慢到达」状态文案。

### R8 资产管线与体积预算

1. THE 系统 SHALL 对 16 张阶段图与 16 格饰物图执行抠图（透明底）后再入包。
2. THE 入包资产 SHALL 控制尺寸：背景图最长边 ≤1600px，阶段立绘高 ≤720px，饰物高 ≤560px。
3. THE 新增资产总体积 SHALL ≤6MB，git 单次提交 SHALL 通过。

### R9 兼容性

1. WHEN 载入 v2 旧档, THE 系统 SHALL 正常运行且补齐穿戴默认值（空）。
2. THE 系统 SHALL 保持 v1 迁移路径与多标签同步、时间回退保护等既有行为。
3. THE 系统 SHALL 保持「领养后类型不可切换」约束。
