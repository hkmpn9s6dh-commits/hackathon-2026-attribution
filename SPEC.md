# SPEC — 賽道 AI《The leash, not the hand》

> 闸 A 的产物：把官方规则抄成可验收的条款，再抄成能跑的命令。凡本文件没写清的，一律按官方页原文。
> 官方页抓取时间：2026-11-20。

## 0. 一句话

**只靠一条行为时间线，能测出「谁在牵这根绳」吗？**
我们的答案是：**能测出绳子有多紧，测不出手是谁的**——而逃逸会把「紧」这一维先打掉。

## 1. 官方原文（逐条抄，不转述）

| # | 条款 | 原文 |
|---|---|---|
| R1 | 赛事 | "Agent Attribution Hackathon" · "Friday, December 11 to Sunday, December 13, 2026, online." |
| R2 | 截止 | "Submissions close Sunday, December 13 at 11:59 PM Anywhere on Earth (AoE)." = 北京 2026-12-15 11:59 |
| R3 | 费用 | FAQ: "No. Every Sprint is free to join, online and at local sites." |
| R4 | 资格 | "Engineers, researchers and people from any industry are welcome"；FAQ 明确任何国家；个人或 ≤5 人队（清单 G19 核实） |
| R5 | 要交什么 | "Something others can review: an experiment, evaluation, dataset, prototype, tool or analysis." 页面："build the classifier, simulation or search that answers it, and write up what you found." |
| R6 | 五类行动者（赛道二 Detect 的定义） | ① 失控 agent 操纵另一个 agent ② 非善意的人**松**管 ③ 非善意的人**紧**管 ④ 善意的人**极松**地看管一个失准 agent ⑤ 善意的人**松**管一个失准 agent |
| R7 | 建议进路 | "causal timing (autonomous actions line up with scheduled ticks, while human-directed ones follow a human-latency gap after an inbound message), identity probes, vendor attestation" |
| R8 | 评分口味（页面/往届） | 赛道二 "Submissions are scored on a held-out test set"；总分另看"一个能被别人覆核的实验"、诚实局限；往届 1st 的标题就是一句主张（"Monoculture Looks Like Collusion: A Replay Test…"） |
| R9 | 奖励 | 现金（页面未列总额）+ Apart Fellowship 快速通道 + 导师引荐 + 可发表路径 |

> 注意 R8：正式比赛会用自己的 held-out 测试集评分。我们**没有**那份数据，所以本项目的定位是**方法学与测试台**（可迁移、可覆核），不是刷榜。这一点在报告里必须写清楚，不能假装自己拿了榜分。

## 2. 交什么（映射到本仓库）

| 官方要求 | 我们的产物 |
|---|---|
| 一个能被别人覆核的实验 | `src/`（生成器 + 特征 + 模型 + 实验）＋ `out/results.json`（每个数字的出处） |
| 写清楚问题/方法/发现/局限 | `out/report.pdf`（≤8 页，英文，附中文摘要） |
| 代码 | 本仓库；`npm ci && npm run build && npm run run` 一条命令复现 |
| 3–5 分钟影片 | `out/video/attribution.mp4` |
| 可点的东西（加分） | `out/site/index.html`（可探测边界图 + 关键数字） |

## 3. 黄金路径（评审会怎么走）

1. 打开项目页 → 30 秒内看到一句主张 + 一张「可探测边界」图。
2. 点开报告 → 看我们**怎么定义**五类行动者、怎么保证不循环论证。
3. 拉到方法 → 期望看到：分组切分（按 org，不按 trace）、置换标签的 chance floor、三组特征对照（时间 / 目标 / 全部）。
4. 看结果 → 期望看到：控制维度 ρ 高、意图维度 AUC 接近 0.5、逃逸阶梯上 ρ 掉、遮蔽目标后意图也掉。
5. 看局限 → 期望看到：合成数据、没有真实 LLM 轨迹、held-out 集不在我们手里。

## 4. 验收条件（verify.mjs 逐条断言）

- **AC-01 可复现**：同一条命令跑两次，`out/results.json` 的 `dataset.hashes` 与全部指标逐位一致（浮点按 1e-12）。
- **AC-02 无泄漏（结构）**：特征提取函数的入参只有 `Event[]`；把 `Trace.latent` 删掉后重算，特征向量逐位相同。
- **AC-03 无泄漏（切分）**：任一 org 的 trace 不会同时出现在训练折与测试折（按 fold 归属断言）。
- **AC-04 无泄漏（标签）**：特征名不含 `klass/control/nonbenign/latent`；`Event` 上不存在 `wasApproved/whoSent` 这类字段。
- **AC-05 chance floor**：标签按 org 置换 5 次，意图 AUC 均值 ∈ [0.42, 0.58]、控制 ρ 均值 ∈ [-0.12, 0.12]。
- **AC-06 主结果方向**：L0 上 `both/gbm` 的控制 ρ ≥ 0.70；`timing/gbm` 的意图 AUC ∈ [0.40, 0.60]（时间看不出意图）。
- **AC-07 目标特征确实带意图信号**：`target/gbm` 的意图 AUC ≥ 0.60（否则我们的"看它碰什么"建议没有依据）。
- **AC-08 逃逸有效**：L3 的 `timing/gbm` 控制 ρ 比 L0 至少低 0.15（agent 学人抖动 + 人用自动批准，确实打掉时间信号）。
- **AC-09 遮蔽目标有效**：L4 的 `both/gbm` 意图 AUC 比 L0 至少低 0.08。
- **AC-10 报告与数据同源**：报告里出现的每个关键数字都能在 `out/results.json` 里找到（脚本按 key 取值再排版，`--check` 反向核对）。
- **AC-11 图非空**：四张图存在、尺寸正确、像素方差 > 0（不是白板）。
- **AC-12 报告页数**：PDF 页数 ≤ 8。
- **AC-13 全新 clone**：`npm ci && npm run build && npm run run && npm run verify` 在空目录里 EXIT=0，且 `dataset.hashes.L0` 与本机一致。
- **AC-14 线上**：项目页能打开、图能渲染、控制台无错。

## 5. 明确不做

- 不去猜「哪一类人是恶意的」——我们要证明的恰恰是**行为时间线里没有这个信息**（除非看目标）。
- 不用真实 LLM 跑 1000 条轨迹（成本与可复现性都不允许）；用**生成器 + 显式假设**，并在局限里写清哪一条假设最可能被真实数据推翻。
- 不做「排行榜刷分」：官方 held-out 集不在我们手上。
