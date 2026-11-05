# Requirements Document — 自定义角色名字

## Introduction

用户在领养页选择角色时，可以为角色起一个自定义名字。名字贯穿后续所有界面与养育日记；留空时沿用该角色的默认名字（橘汐 / 麦芽 / 阿团 / 团子）。

## Glossary

- **角色（对象）**：被领养的养育对象（cat / dog / baby / plant）。
- **默认名字**：引擎内置的 profiles 名称。
- **自定义名字**：用户在领养确认前输入并随存档保存的名字。

## Requirements

### Requirement 1 — 领养时命名

**User Story:** AS 玩家，I want 在确认领养前为角色起名，so that 陪伴的对象有我赋予的称呼。

#### Acceptance Criteria

1. WHEN 领养弹窗打开或切换所选角色，系统 SHALL 显示名字输入框，占位文案提示留空则沿用当前角色的默认名字。
2. WHEN 玩家输入非空名字并确认领养，系统 SHALL 将去除首尾空白后的名字写入存档，并在角色名牌、称呼与养育日记中使用该名字。
3. WHEN 玩家留空名字并确认领养，系统 SHALL 使用默认名字完成领养。

### Requirement 2 — 名字合法性

#### Acceptance Criteria

1. THE 系统 SHALL 将名字长度限制为 12 个字符以内（输入框 maxlength 与引擎校验一致）。
2. IF 名字去除空白后长度为 0，THE 系统 SHALL 视为未命名并使用默认名字。
3. IF 存档中的名字字段缺失或为 null（旧版存档），THE 系统 SHALL 迁移为 null 并按默认名字展示。

### Requirement 3 — 名字一致性

#### Acceptance Criteria

1. WHILE 存在自定义名字，系统 SHALL 在引擎生成的日志文案（领养、晋级、亲密度、病危、用药、离开）中使用自定义名字。
2. WHILE 存在自定义名字，系统 SHALL 在主页角色名牌、房间名、病危横幅、纪念页中使用自定义名字。
3. THE 系统 SHALL 对进入 innerHTML 渲染路径的名字做 HTML 转义，防止脚本注入。

### Requirement 4 — 重开新故事

#### Acceptance Criteria

1. WHEN 玩家在离场纪念页选择开始新的陪伴，系统 SHALL 清空名字输入框，允许为下一个角色重新命名。
