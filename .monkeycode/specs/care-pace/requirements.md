# Requirements Document

## Introduction

部分养育者觉得默认照护节奏偏密。本需求在设置页增加养育节奏档位：紧致、正常、宽松，用来缩放四项照护的关注间隔。默认保持现有正常节奏。

## Glossary

- **System**: 慢慢长大 v2 规则引擎与界面（engine.js、game.js）。
- **养育节奏**: 设置项，取值 紧致 / 正常 / 宽松。
- **关注间隔**: 两次同名照护之间的冷却小时数，以及需求按该间隔衰减的速度。
- **照护时长**: 单次任务秒数（喂养 5–2 分钟、清洁 30 秒、陪伴 1 分钟、休息或施肥 2 分钟）。

## Requirements

### Requirement 1

**User Story:** AS 养育者, I want 在设置里选择紧致、正常或宽松, so that 我可以按自己的空闲程度调整回来照看的频率。

#### Acceptance Criteria

1. WHEN 养育者打开偏好设置, THE System SHALL 展示养育节奏选项，选项为紧致、正常、宽松。
2. WHEN 养育者尚未选择过养育节奏, THE System SHALL 使用正常档。
3. WHEN 养育者选择某一档并刷新页面, THE System SHALL 恢复该档。

### Requirement 2

**User Story:** AS 养育者, I want 宽松档拉长两次照护之间的等待, so that 同一天不用那么频繁操作。

#### Acceptance Criteria

 1. WHEN 养育节奏为正常, THE System SHALL 使用关注间隔：喂养或浇水按阶段 3/4/5/6 小时，清洁为宝宝 4.5 小时、其余 5 小时，陪伴或晒太阳 3.5 小时，休息或施肥 4 小时。
 2. WHEN 养育节奏为紧致, THE System SHALL 将四项关注间隔乘以 0.75。
 3. WHEN 养育节奏为宽松, THE System SHALL 将四项关注间隔乘以 1.5。
4. WHEN 需求低于 35, THE System SHALL 仍允许 1 分钟后再次照护。

### Requirement 3

**User Story:** AS 养育者, I want 需求下降速度跟着间隔一起变, so that 宽松时不会一边拉长冷却一边更快饿穿。

#### Acceptance Criteria

1. WHEN 结算离线衰减, THE System SHALL 使用缩放后的关注间隔计算每小时流失量。
2. WHEN 养育节奏切换, THE System SHALL 保持单次照护时长、成长日历、夜间半速与亲密度流失不变。
