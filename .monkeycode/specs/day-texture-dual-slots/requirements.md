# Requirements Document

## Introduction

为本轮两件推荐能力立规格：用本机时钟给小屋加上日子纹理（问候、天气行、房间冷暖）；把随身饰物从单件 `worn` 拆成穿戴槽与摆放槽，帽子和地面玩具可以同时出现。大模型对话不在本需求范围内。

## Glossary

- **日子纹理**：按本机当地时钟把一天分成清晨、正午、午后、傍晚、夜里五段，驱动问候语、天气行与房间滤镜。
- **穿戴槽 (wear)**：戴在角色身上的饰物，如同类围巾、项圈、帽子、围兜、学步鞋。
- **摆放槽 (place)**：放在小屋地面或盆边的饰物，如毛线球、牙胶、洒水壶、叶纹陶盆。
- **本机时钟**：浏览器 `Date` 的当地时区，不请求外部天气或时间服务。

## Requirements

### Requirement 1: 时段划分

**User Story:** AS 养育者, I want 打开小屋时能感觉到现在是一天里的哪一段, so that 重复照护的日子有纹理。

#### Acceptance Criteria

1. WHEN 界面根据本机时钟渲染主页, THE 系统 SHALL 按当地小时划分五段：6–10 为清晨，11–13 为正午，14–17 为午后，18–21 为傍晚，22–5 为夜里。
2. WHEN 当地小时落在某一段, THE 系统 SHALL 把该段用于问候语、天气行与房间滤镜，同一小时只对应一段。
3. THE 系统 SHALL 用本机时钟完成时段判断，不发起网络请求。

### Requirement 2: 问候与天气行

**User Story:** AS 养育者, I want 标题和天气行跟着时段变化, so that 每次回来都像走进不同的一天。

#### Acceptance Criteria

1. WHEN 主页渲染且角色仍在身边, THE 系统 SHALL 把问候标题换成该时段的固定文案。
2. WHEN 主页渲染, THE 系统 SHALL 把房间天气行更新为该时段的固定描述（含温度口吻与对应图标）。
3. WHEN 角色已离开, THE 系统 SHALL 保持留念布局，天气行仍显示当前时段。
4. WHEN 气泡不在触摸回应冷却期内且需求均不低于 40 且健康状态为健康或萎靡, THE 系统 SHALL 使用该时段的安心问候，替换单一固定句。

### Requirement 3: 房间冷暖

**User Story:** AS 养育者, I want 房间光线跟着早晚变化, so that 小屋有时间感。

#### Acceptance Criteria

1. WHEN 主页房间场景可见, THE 系统 SHALL 按当前时段给背景层施加滤镜：清晨略暖、午后维持原样、傍晚略暗、夜里明显转冷转暗。
2. WHEN 时段在同一次页面生命周期内变化（跨小时刷新或 15 秒轮询）, THE 系统 SHALL 更新滤镜与文案，无需重新领养。

### Requirement 4: 双槽饰物

**User Story:** AS 养育者, I want 同时给角色戴一件身上的饰物、再在小屋放一件玩具或陶盆, so that 16 件饰物不必互相挤掉。

#### Acceptance Criteria

1. THE 系统 SHALL 为每件饰物指定唯一槽位：身上类进入穿戴槽，地面或盆边类进入摆放槽。
2. WHEN 玩家对已拥有且适龄的饰物执行穿上或放下, THE 系统 SHALL 只改写该饰物所属槽位，另一槽位保持原值。
3. WHEN 玩家对同一槽位的另一件饰物执行穿上或放下, THE 系统 SHALL 用新饰物替换该槽位。
4. WHEN 玩家再次点击已在槽位中的同一件饰物, THE 系统 SHALL 清空该槽位，库存数量保持不变。
5. WHEN 渲染房间, THE 系统 SHALL 同时叠加穿戴槽与摆放槽中的饰物；叶纹陶盆仍走现有裁切与后层绘制。
6. IF 饰物未拥有或未达最低阶段, THEN THE 系统 SHALL 拒绝操作并提示原因。

### Requirement 5: 存档兼容

**User Story:** AS 已有存档的养育者, I want 以前穿上的那一件饰物还在, so that 升级后小屋不空。

#### Acceptance Criteria

1. WHEN 载入 `worn` 为字符串的旧 v2 存档, THE 系统 SHALL 按槽位表把该 id 写入对应槽，另一槽为空。
2. WHEN 载入缺少 `worn` 的旧档, THE 系统 SHALL 将两槽都置为空。
3. WHEN 新建或重新领养, THE 系统 SHALL 将两槽都置为空。
4. THE 系统 SHALL 在校验器中接受对象形态的两槽记录，并核验每个非空 id 属于当前角色、已拥有、且槽位匹配。
