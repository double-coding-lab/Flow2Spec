# Flow2Spec 对外网站与演示

> **定位**：本仓产品自用的宣传网站与演示素材，用于对外介绍 Flow2Spec 的价值、模型与用法。

## 入口与路径

| 说明 | 路径 |
| --- | --- |
| 网站源码 | `website/` |
| 中文网站入口 | `website/src/pages/index.astro` |
| 英文网站入口 | `website/src/pages/en/index.astro` |
| 全局视觉系统 | `website/src/styles/global.css` |
| 遗留中文演示稿 | `presentations/flow2spec-intro-public/index.html` |
| 遗留英文演示稿 | `presentations/flow2spec-intro-public-en/index.html` |

## 网站开发

```bash
cd website
npm install
npm run dev
```

- 本地入口：`http://localhost:4321/Flow2Spec/`
- 静态构建：`npm run build`，产物位于 `website/dist/`
- GitHub Pages 基础路径由 `website/astro.config.mjs` 的 `base: '/Flow2Spec'` 控制。
- 首页 Hero 占满顶部导航以下的首屏；滑动进入正文后，桌面端显示固定章节侧栏，移动端切换为顶部抽屉。

## 发布说明

`scripts/sync-gh-pages.sh` 当前仍发布遗留演示稿。网站首版确认后，将该脚本或 GitHub Pages 工作流切换为发布 `website/dist/`。

## 视觉与内容

- 视觉配方：`mailchimp-freddie`，以暖黄、深墨色、奶油色与少量珊瑚色构成主视觉。
- 页面内容：产品价值、四层模型、渐进式路由、开发闭环、团队协作、快速开始和完整文档入口。
- 文档内容源：复用仓库 `docs/` 与 `docs/en/` Markdown；Astro 构建为网站内部文章页，不复制、不重写正文。
- 文档链接：顶部入口和 Markdown 内部链接均指向网站内部路由；构建阶段同步改写 `docs/images/` 图片资源。
- 文档页面只保留文章正文与章节目录；参考计数和 Markdown 内的中英文切换由网站渲染层隐藏，语言切换统一位于右上角。
- 章节目录只显示链接，并随滚动自动定位当前章节；首页目录从 Hero 结束后的正文区开始出现。
- 遗留演示页继续通过相对路径引用 `.claude/skills/html-ppt/assets/`。

## 维护说明

- 网站内容与交互优先修改 `website/src/`，完整文档正文仍维护在 `docs/` 与 `docs/en/`。
- 演示稿只作为旧发布形态与内容素材维护。
- 路由命中 `flow2spec-presentations` 后，可先读本文件再打开对应源码。
