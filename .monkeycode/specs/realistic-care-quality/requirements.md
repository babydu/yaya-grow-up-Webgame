# Requirements Document

## Introduction

当前照护弹窗允许一次取用多份清洁或喂养物资，效果按份数线性叠加。换尿裤、铲猫砂、换尿垫、擦叶在现实中是当场完成一次；拉开效果的方式是小铺里的品质分档，而不是把同一件东西连用三次。本需求把「一次照护」限制为单次动作，并在清洁与施肥类商品上增加基础 / 舒适 / 优质三档。

## Glossary

- **System**: 慢慢长大 v2 规则引擎与界面（engine.js、game.js、小铺与照护弹窗）。
- **一次性照护**: 一次开始到完成的照护任务，对应现实中当场做完的一件事。
- **品质档**: 同一照护类别下价格与效果不同的消耗品。基础档效果较低、价格较低；优质档效果较高、价格较高。
- **清洁动作**: 动作 id `clean`（宝宝换尿裤、猫铲猫砂、狗换尿垫、植物擦叶除虫）。
- **喂养动作**: 动作 id `food`（喂养；植物浇水为免费动作）。
- **存量键**: 存档 `inventory` 中的商品 id。既有 `{type}-clean` 表示该类型原先唯一的清洁品。

## Requirements

### Requirement 1

**User Story:** AS 养育者, I want 换尿裤这类动作一次只用一份物资, so that 游戏节奏贴近现实里「换一次就是一次」。

#### Acceptance Criteria

1. WHEN 养育者对清洁动作开始照护, THE System SHALL 将本次任务的物资数量固定为 1。
2. WHEN 养育者对清洁动作传入大于 1 的数量, THE System SHALL 拒绝开始并返回说明数量无效的文案。
3. WHILE 照护弹窗展示清洁动作且库存物资可选, THE System SHALL 隐藏份数步进器。
4. WHEN 养育者完成一次清洁照护, THE System SHALL 按所选商品的单份 `gain` 增加需求，并按该商品的单份耗时计时。

### Requirement 2

**User Story:** AS 养育者, I want 小铺按品质出售尿裤、猫砂、尿垫、叶喷和花肥, so that 花更多积分能换来更干净或更饱的一次照料。

#### Acceptance Criteria

1. WHEN 目录完成加载, THE System SHALL 为 baby、cat、dog、plant 各提供三档清洁商品，存量键分别为 `{type}-clean`（舒适）、`{type}-clean-basic`（基础）、`{type}-clean-plus`（优质）。
2. WHEN 养育者查看清洁商品, THE System SHALL 使用下列单份洁净度效果与价格：基础 gain 洁净 35、价格 8；舒适 gain 洁净 45、价格 10；优质 gain 洁净 55、价格 16；每组仍为 5 份。
3. WHEN 目录完成加载, THE System SHALL 为 plant 的阶段花肥各提供对应的优质档 `{stage}-plus`，单份养分 gain 55、价格比同阶段基础花肥高 6 积分。
4. WHEN 养育者在小铺或照护弹窗查看消耗品, THE System SHALL 展示该商品对主需求的单份恢复量。
5. WHEN 养育者完成一次使用优质清洁品的照护, THE System SHALL 将洁净度提高 55 点（受 100 封顶约束）。

### Requirement 3

**User Story:** AS 养育者, I want 喂养仍可按一餐取用, so that 饿了可以多喂一点，同时避免把三瓶奶一次灌下去。

#### Acceptance Criteria

1. WHEN 养育者对喂养动作开始照护, THE System SHALL 允许数量为 1 或 2。
2. WHEN 养育者对喂养动作传入大于 2 的数量, THE System SHALL 拒绝开始并返回说明数量无效的文案。
3. WHEN 养育者对营养均衡组合开始照护, THE System SHALL 将数量固定为 1（该商品已是完整一餐）。
4. WHEN 养育者对玩耍使用玩具或对安抚休息开始照护, THE System SHALL 将数量固定为 1。

### Requirement 4

**User Story:** AS 已有存档的养育者, I want 旧的尿裤和猫砂还能用, so that 更新后背包不会出现无效物品。

#### Acceptance Criteria

1. WHEN System 载入含 `{type}-clean` 的既有 v2 存档, THE System SHALL 把该存量视为舒适档清洁品并允许继续用于清洁动作。
2. WHEN 养育者首次领养, THE System SHALL 赠送舒适档清洁品 `{type}-clean` 5 份与对应奶粉或营养液 5 份。
3. WHEN 每日基础补给发放清洁类物资, THE System SHALL 补充舒适档 `{type}-clean`。

### Requirement 5

**User Story:** AS 养育者, I want 商品说明写清这是游戏化品质差, so that 不会把积分档位理解成现实育儿或园艺标准。

#### Acceptance Criteria

1. WHEN 养育者查看品质分档商品的描述, THE System SHALL 注明效果差异属于游戏模拟，现实照护请咨询专业人士。
2. WHEN 养育者打开照护弹窗, THE System SHALL 在预计恢复文案中写明所选档位的单份效果。
