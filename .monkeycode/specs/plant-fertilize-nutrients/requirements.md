# Requirements Document

## Introduction

植物第四项照护「安静生长」把养分当成陪伴休息。现实里养分来自施肥，浇水只补水分。本需求把第四项改为施肥并消耗花肥 / 营养液，浇水改为免费动作且只恢复水分。

## Glossary

- **System**: 慢慢长大 v2 规则引擎与界面（engine.js、game.js）。
- **浇水动作**: 动作 id `food`，植物显示名为浇水，对应需求「水分」。
- **施肥动作**: 动作 id `energy`，植物显示名为施肥，对应需求「养分」。
- **花肥**: 目录中植物 `category` 为 `food` 的消耗品（`plant-milk`、`plant-food-{1..3}`、`plant-food-{i}-plus`），存量键保持不变。
- **营养组合**: `plant-nutrition`，`category` 为 `nutrition`，一次完整施肥。

## Requirements

### Requirement 1

**User Story:** AS 团子的养育者, I want 第四项照护叫施肥并且消耗花肥, so that 养分来自肥料而不是安静陪伴。

#### Acceptance Criteria

1. WHEN System 为 plant 生成照护选项, THE System SHALL 返回动作名 浇水、擦叶除虫、晒太阳、施肥。
2. WHEN 养育者对植物施肥动作开始照护, THE System SHALL 要求选择一份当前阶段可用的花肥或营养组合。
3. WHEN 养育者完成一次使用日常花肥的施肥, THE System SHALL 按该商品的单份 `gain` 增加养分（受 100 封顶约束）。
4. WHEN 养育者对植物施肥动作不选择消耗品, THE System SHALL 拒绝开始并返回请选择消耗品的文案。

### Requirement 2

**User Story:** AS 团子的养育者, I want 浇水只补水分并且不用花肥, so that 浇水和施肥是两件分开的事。

#### Acceptance Criteria

1. WHEN 养育者对植物浇水动作开始照护, THE System SHALL 允许不选择消耗品。
2. WHEN 养育者完成一次植物浇水, THE System SHALL 只增加水分，增量为该动作的默认 gain 45（受 100 封顶约束）。
3. WHEN 养育者查询植物浇水动作的可用商品, THE System SHALL 返回空列表。
4. WHEN 养育者查询植物施肥动作的可用商品, THE System SHALL 返回当前阶段可用的花肥与营养组合。

### Requirement 3

**User Story:** AS 养育者, I want 花肥主要补养分, so that 小铺档位差体现在施肥效果上。

#### Acceptance Criteria

1. WHEN 目录完成加载, THE System SHALL 为 `plant-milk` 与 `plant-food-{1,2,3}` 提供单份养分 gain 45。
2. WHEN 目录完成加载, THE System SHALL 为 `plant-food-{1,2,3}-plus` 提供单份养分 gain 55，价格比同阶段日常花肥高 6 积分。
3. WHEN 目录完成加载, THE System SHALL 为 `plant-nutrition` 提供单份养分 gain 50 与水分 gain 15。
4. WHEN 养育者对日常花肥开始施肥, THE System SHALL 允许数量为 1 或 2。
5. WHEN 养育者对营养组合开始施肥, THE System SHALL 将数量固定为 1。

### Requirement 4

**User Story:** AS 已有存档的养育者, I want 背包里的营养液和花肥还能用, so that 更新后物资不会作废。

#### Acceptance Criteria

1. WHEN System 载入含 `plant-milk` 或 `plant-food-*` 的既有 v2 存档, THE System SHALL 把这些存量视为施肥消耗品。
2. WHEN 养育者首次领养植物, THE System SHALL 赠送 `plant-milk` 5 份与舒适档叶喷 5 份。
3. WHEN 植物缺少施肥或清洁物资时领取每日基础补给, THE System SHALL 补充当前阶段花肥或舒适档叶喷各 2 份。
