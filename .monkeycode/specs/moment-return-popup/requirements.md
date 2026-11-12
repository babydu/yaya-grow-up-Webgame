# Requirements Document: 短时小事件回归弹窗

## Introduction

短时小事件的回应窗口只有 10 秒，养育者不可能一直守在游戏窗口前。当事件在养育者离开窗口（标签页隐藏或失焦）期间到达时，此前仅靠后台节流刻度静默顺延。系统应在养育者回到窗口的那一刻主动弹出事件卡片，让养育者能够及时处置。

## Glossary

- **短时小事件**: 引擎按冷却间隔排程的限时轻互动提示，回应窗口 10 秒。
- **回归弹窗**: 养育者将页面从隐藏切换为可见时，系统对已到期事件主动弹出的事件卡片。
- **到期事件**: `momentDueAt` 已到达、尚未开始的事件。
- **进行中事件**: 已调用 `startMoment`、回应窗口尚未结束的事件。
- **顺延**: 现行规则下进行中的事件被收起、不奖不罚并重新进入冷却。

## Requirements

### Requirement 1: 回归即弹出

**User Story:** AS 养育者, I want 回到窗口时看到已到期的短时小事件, so that 我能及时回应它而不是错过。

#### Acceptance Criteria

1. WHEN 页面从隐藏切换为可见，AND 存在到期事件，THE 系统 SHALL 立即开始该事件并弹出事件卡片。
2. WHEN 回归弹窗弹出，THE 系统 SHALL 展示角色化文案、回应按钮与全新 10 秒回应窗口及剩余秒数。
3. IF 离开窗口期间有多个冷却先后到期，THE 系统 SHALL 在回归时只弹出一个事件，其余按既有冷却规则顺延。

### Requirement 2: 离开期间的进行中事件不追罚

**User Story:** AS 养育者, I want 离开窗口时正在倒计时的事件不被算作错过, so that 惩罚只来自我明确看到的窗口。

#### Acceptance Criteria

1. WHILE 进行中事件因页面隐藏而中断，THE 系统 SHALL 保持现行顺延规则：收起事件、亲密度不变、重新进入冷却。
2. WHEN 回归弹窗的事件被点击回应，THE 系统 SHALL 按既有规则执行亲密度 +2 并写入日记。
3. WHEN 回归弹窗的回应窗口结束且未点击，THE 系统 SHALL 按既有规则执行亲密度 -1 并写入日记。

### Requirement 3: 回归弹窗的条件门槛

**User Story:** AS 养育者, I want 回归弹窗遵守与页面内弹出相同的门槛, so that 规则保持一致。

#### Acceptance Criteria

1. IF 回归时照护弹窗处于打开状态，THE 系统 SHALL 推迟回归弹窗，待照护弹窗关闭后按冷却规则弹出。
2. IF 活跃角色为小植物、非活跃或已离开，THE 系统 SHALL 不弹出回归弹窗。
3. WHILE 短时小事件静默冷却（`momentQuietUntil`）未结束，THE 系统 SHALL 推迟回归弹窗。

## References

[^1]: (game.js#369) — `pulseMoment` 在 `document.hidden` 时调用 `deferMoment`，是本次回归弹窗要补齐的路径
[^2]: (engine.js#747) — `startMoment` 的到期判定与冷却排程
[^3]: (.monkeycode/specs/short-moments/requirements.md) — 短时小事件既有规格，回应窗口、奖惩与冷却规则来源
