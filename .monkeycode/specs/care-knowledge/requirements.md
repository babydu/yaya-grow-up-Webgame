# Requirements Document — 养育课堂（照护知识科普）

## Introduction

在照护过程中向玩家推送与当前角色、当前照护动作相关的真实养护知识，并提供独立的「养育课堂」页面系统学习。内容为本地静态科普摘要，面向 baby / cat / dog / plant 四类角色。

## Glossary

- **养护知识条目**：一条有分类、标题与正文的科普内容。
- **照护动作分类**：food→喂养营养，clean→清洁护理，mood→情感陪伴，energy→健康与观察。
- **已读**：玩家在养育课堂展开过该条目。

## Requirements

### Requirement 1 — 照护完成推送知识

**User Story:** AS 玩家，I want 在完成照护时学到真实养护知识，so that 游戏中的每一次照料都有现实参照。

#### Acceptance Criteria

1. WHEN 一次照护任务完成，系统 SHALL 在完成弹窗中展示一条与当前角色及当前照护动作分类匹配的知识条目。
2. WHEN 同一照护动作连续多次完成，系统 SHALL 在该分类的知识池中轮换推送，相邻两次展示不同条目。
3. IF 当前分类的知识池为空，THE 系统 SHALL 隐藏知识区块，完成弹窗其余内容保持不变。
4. THE 完成弹窗 SHALL 提供进入养育课堂的入口。

### Requirement 2 — 养育课堂页面

#### Acceptance Criteria

1. THE 系统 SHALL 在侧边导航提供「养育课堂」页面入口。
2. THE 养育课堂 SHALL 按角色分页签展示知识条目，并按照护动作分类分组，默认选中当前养育角色。
3. THE 系统 SHALL 显示当前角色的阅读进度（已读条数 / 总条数）。

### Requirement 3 — 阅读状态

#### Acceptance Criteria

1. WHEN 玩家展开一条知识条目，THE 系统 SHALL 将其标记为已读并持久化。
2. WHILE 条目处于已读状态，THE 系统 SHALL 在条目上展示已读标记。
3. WHEN 玩家刷新页面，THE 系统 SHALL 保留已读状态。

### Requirement 4 — 内容安全

#### Acceptance Criteria

1. THE 知识内容 SHALL 为通用科普摘要，并附「具体养育决策请咨询儿科医生、兽医或园艺专业人士」的免责说明。
2. THE 知识内容 SHALL 全部来自本地静态数据，系统运行期间不发起任何外部网络请求。
