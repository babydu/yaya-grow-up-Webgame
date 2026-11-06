# Requirements Document — 背包与饰物穿戴修复

## Introduction

新增「我的背包」页面：生活小铺购买的商品统一收纳于此并在此使用，小铺回归纯购买入口。饰物类为非消耗品（可反复穿戴、脱下收回背包），消耗品使用后减少。同时修复饰物穿戴位置：植物陶盆应替换默认花盆，其余饰物按物品形态佩戴或摆放在合理位置。

## Glossary

- **背包**：以存档 inventory 为数据源的收纳页。
- **消耗品**：使用后数量递减的商品（物资类、医疗类、陪伴玩具）。
- **非消耗品**：随身饰物，穿戴状态切换，数量始终保留。

## Requirements

### Requirement 1 — 背包页

**User Story:** AS 玩家，I want 有一个统一的背包，so that 买到的物品集中管理、在背包里使用。

#### Acceptance Criteria

1. THE 系统 SHALL 在侧边导航提供「我的背包」页面，列出库存大于 0 的全部商品，按「照护物资 / 医疗照护 / 随身饰物」分组并显示持有数量。
2. WHEN 背包为空，THE 系统 SHALL 展示空状态并提供前往生活小铺的入口。
3. WHEN 玩家在背包使用医疗类物品，THE 系统 SHALL 执行与工具箱一致的门控（安心药箱：健康度 <70；回春灵药：健康度 <70 或病危窗口）。
4. WHEN 玩家在背包点击照护物资的「去照护」，THE 系统 SHALL 打开对应分类的照护弹窗。
5. THE 生活小铺 SHALL 移除使用与穿戴按钮：已拥有的医疗品与饰物展示「去背包使用 / 去背包穿戴」入口，购买按钮保持不变。

### Requirement 2 — 饰物的非消耗语义

#### Acceptance Criteria

1. WHEN 玩家在背包穿戴饰物，THE 系统 SHALL 将饰物标记为穿戴中，库存数量保持不变。
2. WHEN 玩家再次点击已穿戴的饰物，THE 系统 SHALL 脱下并收回背包（日志记录脱下动作）。
3. WHILE 饰物处于穿戴状态，THE 系统 SHALL 在背包中显示「穿戴中」标记。

### Requirement 3 — 饰物穿戴位置修复

#### Acceptance Criteria

1. WHEN 植物佩戴叶纹陶盆，THE 系统 SHALL 将陶盆渲染在植株底部替换默认花盆的位置，而非挂在植株上部。
2. WHEN 饰物为摆件形态（玩具、工具、洒水壶等），THE 系统 SHALL 将其渲染在角色旁边的地面位置。
3. WHEN 饰物为穿戴形态（帽子、围巾、项圈、头巾、围兜、鞋子），THE 系统 SHALL 将其渲染在角色对应的身体部位。
4. THE 各阶段的渲染 SHALL 随角色缩放比例保持相对位置稳定。

### Requirement 4 — 内容安全

#### Acceptance Criteria

1. THE 背包与小铺的所有操作 SHALL 复用现有引擎校验（begin/remedy/wear/buy），系统 SHALL NOT 引入绕过门控的新路径。
