---
id: flow2spec-presentations
revision: 0
summary: flow2spec-presentations
primary: feature
confidence: inferred
---
# flow2spec-presentations

## 执行边界

- 本主题用于说明本仓库内 Flow2Spec 对外网站与遗留 HTML 演示稿的位置、预览方式和维护边界。
- 对外材料归属 `stock-docs` 索源说明，不作为 `req-docs` 驱动业务实现。

## 目标

当用户询问「宣传网站」「Astro 官网」「对外演示」「presentations 目录」时，命中本主题后：

1. 网站源码位于 `website/`，使用 Astro 构建；中文入口为 `/`，英文入口为 `/en/`。
2. 网站采用滚动式产品叙事：首页 Hero 独立占满顶部导航以下的首屏，正文区从下一屏开始并提供固定章节侧栏；移动端提供可展开导航；视觉方向为 `mailchimp-freddie` 暖人文风格。
3. `presentations/flow2spec-intro-public/` 与 `presentations/flow2spec-intro-public-en/` 保留为旧演示稿和内容素材。
4. 首版网站不接管 `scripts/sync-gh-pages.sh`；确认设计后再切换线上发布链路。
5. 需要架构级背景时，可再读 `f2s-flow2spec-architecture` 主题。

## 边界

- `docs/` 与 `docs/en/` 中的 Markdown 是完整参考的唯一内容源；Astro 构建时读取原文，统一套用文章布局、目录、代码块、表格、图片和链接样式，不复制或重写正文。
- 顶部导航指向网站内部的文档文章页；构建阶段把 Markdown 内部 `.md` 链接与 `docs/images/` 图片改写为站内路径。
- 首页和文章页左侧目录由页面标题生成，并按滚动位置自动高亮当前章节；目录只保留章节链接，不显示标题、说明或分割线；移动端目录收进顶部可展开导航。
- 首页 Hero 结束后才显示正文区和左侧目录；文章页不显示参考计数，Markdown 顶部的中英文切换段由构建阶段移除，语言入口统一位于右上角。
- 桌面文档侧栏的间距按侧栏自身宽度计算，横向溢出隐藏；低高度视口内容实际溢出时才启用纵向滚动。
- 遗留演示稿仍依赖 `.claude/skills/html-ppt/assets/`，移动或独立发布时须同步处理资源路径。

## 下一步

- 索源与路径表：[对外网站与演示](../stock-docs/Flow2Spec-对外介绍演示.md)
- 架构总览：`.Knowledge/topics/f2s-flow2spec-architecture.md`
