# Flow2Spec 介绍 PPT · 大纲(16 页,与 flow2spec-intro-public HTML 版 1:1)

> 视觉风格:赛博终端风(深蓝黑底 + 青/品红霓虹强调 + 等宽代码字体质感),与 HTML 版品牌一致。
> 无必须嵌入的源图片。

Slide 1: 封面 · Flow2Spec · 让 AI 一直知道你在做什么
- 角色: cover
- 要点: 你的 AI 失忆了吗 / 跨设备会话记住项目上下文 / 路由清单只拿该拿的 / f2s-* 改代码顺手更新知识 / Memory Coding:记忆编码进仓库,可 diff 可协作

Slide 2: Before / After · 同一句需求
- 角色: comparison
- 要点: 真实需求「图片素材库+图片模型合成素材库」横跨接口层 B + 管理台 C;左:反复问模块在哪个仓/库表/老字段,3 仓翻代码;右:matcher 命中 m-image-model-dispatcher,跨仓 4 topic 秒出结论(合并/菜单合一/templateUuid 可空/imageMaterial* 命名);差别在上下文变准,不是模型变强

Slide 3: 4 仓实测数据
- 角色: data evidence
- 要点: 主仓 A(前端主仓 3 年)1012 核心文件 12.9 万行·43 topic·27 作者·2786 commit → 每次只读几百行,27 人零串戏;接口项目 B 213 文件·25 topic·54 req-doc;B 端 C 73 文件·20 topic;C 端 D 28 文件·15 topic;合计 16.5 万行·103 topic·193 沉淀文档·80 归档任务

Slide 4: 带着你的痛点横着看(竞品矩阵)
- 角色: comparison matrix
- 要点: 6 痛点 × 5 对手(OpenSpec / Superpowers 类 / RAG 向量库 / Spec Kit 类 / Claude Memory)+ Flow2Spec 列;F 列:kb-feat/fix 改代码带改知识库·kb-sync 手动全量补·kb-add 模块入库 / matcher+依赖链几百行 / 三层 topic-终稿-代码 / 各客户端原生加载(含 DeepSeek Harness)/ .task 续作 80 归档 / .Knowledge 全落盘可 review;自曝短板:不同步知识库仍会腐化

Slide 5: Memory Coding · 四环协同
- 角色: architecture
- 要点: 知识环 .Knowledge(manifest/matchers/topics/stock/req 多层记忆,按需递进够则停)/ 任务环 .task(续作清单)/ 规则环(怎么读怎么做)/ 技能环 f2s-*(维护与触发);环间关系:技能维护知识·规则路由读库·技能写任务留痕

Slide 6: 渐进式读取 · 先查目录再翻书
- 角色: process
- 要点: 一句「改评价模板文案库的批量重评分」走四步:match(命中 matcher 只读一个分片)→ expand(+3 依赖 topic)→ verify(缺口检查不够先澄清)→ act(改代码带硬约束);金句:4.7 MB 源码 → 300 行 topic,切噪声不是变聪明

Slide 7: 横读 + 纵链 · 先收窄再叠层
- 角色: concept explanation
- 要点: 横读 L0 manifest → L1 matchers → L2 topics → L3 stock/req;纵链 topicDependencies 只说「商品评价」自动叠四层(common → platform → whitelist → template-library);挂一次全任务共享

Slide 8: 硬约束密度 · 每条 topic 都是挡错防线
- 角色: case study
- 要点: 拼团+通用券案例:同事务双写 / 团长上限按 type 隔离 / 券只传 activityCode / status 优先级 0>1>2>3>4;这些约束看代码猜不出;知识库是改代码→踩坑→写进 topic→挡后续错长出来的

Slide 9: 任务续作 · 会话断了自己接上
- 角色: process + case
- 要点: 真实任务 9 步多次会话,下次只说「继续」;todo.json 关键词命中 → 读剩余步骤 → 加载规则技能续作;目录:todo.json / active(task.md·context.md·user-todos.md)/ completed;user-todos.md 交接 DDL、开关、发版等线下事项

Slide 10: 多人协作 · 任务隔离,知识共享
- 角色: concept + data
- 要点: 主仓 A 三个月 27 作者·2786 commit·43 归档任务;4 仓同一份 config 全开(subAgent/switchAgentVerification/intentRecognition/changeTracking/collaboration);.task 按 developerId 分目录不串戏;.Knowledge 仍是团队共享单源

Slide 11: 4 仓一览 · 同一套体系
- 角色: data table
- 要点: 3K 行 C 端项目到 12.9 万行主仓,规模跨 40 倍,topic 15→43 近线性;req-docs 总数(125)> stock-docs(68):知识是日常迭代驱动长出来的

Slide 12: 渐进式建库 · 写着用,不用先写完
- 角色: timeline
- 要点: 最小可用集 1 manifest + 1 matcher + 1 topic;init 约 1 分钟拉骨架 → 首次接入(f2s-doc-arch 出全景 + f2s-kb-add 命中模块提前入库)→ 日常(kb-feat/kb-fix/git-commit)→ 维护(kb-sync/kb-merge);下次需求命中哪块写哪块

Slide 13: 命令地图 · 4 个日常必用记住就够 80%
- 角色: command map
- 要点: 4 主力:kb-feat(加能力)/ kb-fix(修 bug 带挡错)/ git-commit(提交前 3 查)/ req-clarify→req-tech(大需求入口);知识维护三剑客:kb-distill(对话完提取)/ kb-add(存量批量入库)/ kb-sync(全局找漏);开启 intentRecognition 后自然语言直接路由不用敲命令;其余按需

Slide 14: 真实案例 · 评价模板文案库
- 角色: case study / roadmap
- 要点: 主线 6 步:clarify(两轮成批澄清)→ req-tech(四层依赖出方案+5 份 DDL)→ 实现(8 步 checklist 可续作)→ kb-feat → kb-fix → git-commit(冲突扫/KB 覆盖查/规范首行)

Slide 15: 说实话 · 什么时候不要用
- 角色: honest limits
- 要点: 一次性脚本临时工具 / 单人小项目 / 团队不愿同步 .Knowledge —— 结构投入换长期复利,不划算就别硬上

Slide 16: 收束
- 角色: closing
- 要点: 不是让 AI 更聪明,是让 AI 一直知道你在做什么;github.com/double-coding-lab/Flow2Spec;npx @double-coding/flow2spec@latest init;老项目 f2s-kb-upgrade;欢迎试用交流
