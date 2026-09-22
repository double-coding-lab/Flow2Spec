# Flow2Spec 介绍 · 演讲备注

> 与 `origin_image/slide_XX.png` 一一对应;组装时写入每页 PPT 备注。建议 28–35 分钟。

## Slide 1

大家好,我们是 double-coding-lab。你的 AI 失忆了吗?新会话不记得上一轮,不知道项目结构,团队约定也接不上。模型可以还是同一个,上下文断了,表现就会飘。Flow2Spec——让 AI 一直知道你在做什么。先记一个概念:Memory Coding,把记忆编码进仓库,可 diff、可协作。

## Slide 2

同一句需求:「把图片素材库和图片模型合成一个素材库」,真实需求,横跨接口层 B 和管理台 C 两个仓。左边没有 Flow2Spec:反复问模块在哪个仓、库表分不分、老字段还有没有引用、菜单合不合,三个仓翻代码。右边:matcher 一次命中,跨仓 4 个 topic 秒出结论——两表合并、菜单合一、templateUuid 改可空、接口沿用 imageMaterial* 命名。差别在上下文变准,而且跨仓的约束也在,不是模型变强。

## Slide 3

这不是概念,是日常。四个真实生产仓同一套 Flow2Spec。主仓 A 三年,1012 核心文件 12.9 万行,43 个 topic,27 位作者三个月 2786 次 commit——12.9 万行代码,AI 每次只读几百行,27 人并发零任务串戏。接口项目 B 的 req-doc 有 54 份,接近 stock-doc 的四倍——知识是实现驱动长出来的。B 端项目 C 和 C 端项目 D 说明:5K 行、3K 行的小仓一样长得起来,不是大项目才能用。

## Slide 4

带着你的痛点横着看。不比家数,比六个真实痛点在每家会怎样:spec 追得上代码吗、大仓要读多少、有没有分层精读、换 IDE 换模型怎样、会话断了怎么接、能不能 diff review。Flow2Spec 这列:kb-feat/fix 改代码带改知识库,kb-sync 随时手动全量补,kb-add 随时把模块解析入库;matcher 加依赖链每次几百行;topic、终稿、代码三层递进;规则+知识+技能在各客户端原生加载,包括 DeepSeek Harness。最后必须讲短板:不同步知识库,仍会腐化——工具不能替代纪律。

## Slide 5

一张图,Memory Coding 四环协同。把要记住的东西编码进可提交的仓,不押在模型或聊天里。知识环 .Knowledge/ 是多层记忆,按需递进、够则停;任务环 .task/ 管续作;规则环规定怎么读怎么做;技能环 f2s-* 负责维护和触发。环间关系:技能维护知识、规则路由读库、技能写任务留痕。

## Slide 6

渐进式读取,先查目录再翻书。用户说一句「改评价模板文案库的批量重评分」,走四步:match 命中 matcher 只读一个分片;expand 自动拉 3 个依赖 topic;verify 做缺口检查,置信度不足先澄清;act 才开始改代码。金句:4.7 MB 源码到 300 行 topic——切噪声,不是变聪明。

## Slide 7

横读加纵链。横读是 L0 manifest 到 L3 stock/req 逐层收窄;纵链是 topicDependencies:你只说了「商品评价」,manifest 自动叠四层——common-modules、social-media-platform、whitelist、product-review-template-library。横读切噪声,纵链挂主题级依赖,挂一次全任务共享。

## Slide 8

每一条 topic 都是挡 AI 犯错的防线。拼团加通用券的真实案例,四条约束:主表明细表同事务双写、团长上限按 type 隔离、券只传 activityCode、status 优先级 0>1>2>3>4。这些看代码猜不出。知识库就是改代码、踩坑、写进 topic、挡后续错,这么长出来的。

## Slide 9

会话断了,AI 自己接上。真实任务九步清单跨多次会话,下次只说「继续」:关键词命中 todo.json,读剩余步骤,加载规则技能,断点续作。user-todos.md 专门交接 DDL、开关、发版这些必须用户线下完成的事,落盘不丢。

## Slide 10

多人协作:任务隔离,知识共享。主仓 A 三个月 27 位作者 2786 commit 43 归档任务,真实团队并发。.task/ 按 developerId 分目录,同事任务不串戏;.Knowledge/ 仍是团队共享单源。隔离的是任务状态,共享的是知识事实。

## Slide 11

4 仓一览,让数据自证。从 3K 行到 12.9 万行规模跨 40 倍,topic 数 15 到 43 近线性。一个观察:req-docs 总数 125 大于 stock-docs 的 68——知识不是一次性文档,是日常迭代驱动长出来的。时间紧这页让屏幕自证,不逐仓念。

## Slide 12

写着用,不用先写完。最小可用集就一条 manifest、一个 matcher、一份 topic。时间线:init 一分钟拉骨架;首次接入跑 /f2s-doc-arch 出全景,再 /f2s-kb-add 把当前需求命中的模块提前入库;日常就是 kb-feat、kb-fix、git-commit;维护按需 kb-sync、kb-merge。下次需求命中哪块,写哪块。

## Slide 13

命令地图:4 个日常必用记住就够 80%。kb-feat 加能力、kb-fix 修 bug 带挡错、git-commit 提交前三查、req-clarify 到 req-tech 是大需求入口。知识维护三剑客:kb-distill 对话完顺手提取、kb-add 存量批量入库、kb-sync 全局找漏。开启 intentRecognition 后这些触发词不用手动敲命令,自然语言直接说就自动路由。

## Slide 14

真实案例走一遍:评价模板文案库。六步:clarify 两轮成批澄清;req-tech 出方案带 5 份 DDL;说「实现这个技术方案」进入 8 步 checklist 可续作;kb-feat 说需求等于实现加入库;kb-fix 修实现带改 topic;最后 git-commit 三查收尾。时间紧只讲 1、3、6。

## Slide 15

说实话,什么时候不要用:一次性脚本;单人小项目一份 CLAUDE.md 够了;团队不愿意同步 .Knowledge/。结构投入换长期复利,不划算就别硬上。

## Slide 16

收束:不是让 AI 更聪明,是让 AI 一直知道你在做什么。仓库 github.com/double-coding-lab/Flow2Spec,一条命令 npx @double-coding/flow2spec@latest init 就能开始,老项目对话点名 f2s-kb-upgrade。欢迎试用、提 issue、交流。谢谢大家。
