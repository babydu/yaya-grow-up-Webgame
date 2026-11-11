# Requirements Document

## Introduction

为小猫、小狗、宝宝增加偶尔出现的短时小事件：弹窗提示一句当下需求（例如打嗝、想玩球、做噩梦），养育者有 10 秒完成一次轻互动。小植物走安静养成，不出现此类事件。领养页须写清四种角色在互动节奏上的差别。

## Glossary

- **System**: 慢慢长大 v2 规则引擎与界面（engine.js、game.js）。
- **短时小事件**: 一次限时 10 秒的轻互动提示，与四项照护任务、触摸冷却相互独立。
- **回应窗口**: 事件出现后允许点击完成的 10 秒。
- **活跃角色**: 已领养且状态为存活（status 为 alive）的角色。
- **安静养成**: 小植物团子的养育方式：日常浇水、擦叶、晒太阳、施肥，无短时小事件。
- **冷却间隔**: 两次短时小事件开始时刻之间的等待，由 System 在 10 至 25 分钟内随机取值。

## Requirements

### Requirement 1

**User Story:** AS 养育者, I want 在领养时看清四种角色的互动节奏, so that 我能按自己喜欢热闹还是安静来选择。

#### Acceptance Criteria

1. WHEN 养育者打开领养页, THE System SHALL 在每种角色卡片上展示一句互动节奏说明。
2. WHEN 养育者选中小猫、小狗或宝宝, THE System SHALL 在摘要中说明该角色会偶尔出现 10 秒内可完成的短时小事件。
3. WHEN 养育者选中小植物, THE System SHALL 在摘要中说明小植物为安静养成，不会弹出短时小事件。

### Requirement 2

**User Story:** AS 养育者, I want 陪伴小猫、小狗或宝宝时偶尔看到一句当下需求, so that 我能用十秒回应它。

#### Acceptance Criteria

1. WHILE 活跃角色为小猫、小狗或宝宝，且健康度不低于 20、照护弹窗未打开, THE System SHALL 在冷却间隔结束后弹出一条短时小事件。
2. WHEN 短时小事件出现, THE System SHALL 展示一句按角色区分的文案、一个可点击的回应按钮，并将回应窗口设为 10 秒。
3. WHILE 回应窗口尚未结束, THE System SHALL 在界面上显示剩余秒数。
4. WHILE 活跃角色为小植物, THE System SHALL 保持无短时小事件。
5. WHILE 照护弹窗打开, THE System SHALL 推迟弹出短时小事件。

### Requirement 3

**User Story:** AS 养育者, I want 点到有一点亲密、错过只扣一点, so that 奖大于罚。

#### Acceptance Criteria

1. WHEN 养育者在回应窗口内点击回应, THE System SHALL 立即结束该事件，将亲密度提升 2（上限 100），并写入一条养育日记。
2. WHEN 回应窗口结束且养育者未点击, THE System SHALL 收起该事件，将亲密度降低 1（下限 0），并写入一条养育日记。
3. WHEN 短时小事件结束（完成或错过）, THE System SHALL 开始下一次冷却，冷却时长为 10 至 25 分钟的随机值。
4. WHEN 养育者在回应窗口内打开照护弹窗, THE System SHALL 收起该事件且保持亲密度不变，并重新进入冷却。

### Requirement 4

**User Story:** AS 养育者, I want 小事件文案贴合角色, so that 打嗝、玩球、噩梦听起来像这个小生命会说的话。

#### Acceptance Criteria

1. WHEN 活跃角色为小猫, THE System SHALL 从猫向文案池抽取一条，池中包含打嗝、想玩球、做噩梦三类。
2. WHEN 活跃角色为小狗, THE System SHALL 从狗向文案池抽取一条，池中包含打嗝、想玩球、做噩梦三类。
3. WHEN 活跃角色为宝宝, THE System SHALL 从宝宝文案池抽取一条，池中包含打嗝、想玩球、做噩梦三类。
4. WHEN 连续两次短时小事件, THE System SHALL 使用不同的文案 id。
