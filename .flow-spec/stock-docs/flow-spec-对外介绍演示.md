# flow-spec 对外介绍演示（公仓演示稿）

> **定位**：本仓（开源仓）**产品自用**的静态 HTML 演讲稿，用于对外分享 flow-spec 价值与用法；**不是**业务实现的 `req-docs` 输入，也不替代 `flow-spec init` 落盘的模板知识库。

## 入口与路径

| 说明 | 路径 |
| --- | --- |
| 中文演示稿目录 | `presentations/flow-spec-intro-public/` |
| 中文主页面 | `presentations/flow-spec-intro-public/index.html` |
| 英文演示稿目录 | `presentations/flow-spec-intro-public-en/` |
| 英文主页面 | `presentations/flow-spec-intro-public-en/index.html` |

在仓库根用浏览器打开对应 `index.html` 即可本地预览（键盘翻页等行为由 html-ppt 运行时提供）。

## 发布说明

执行 `scripts/sync-gh-pages.sh` 将演示稿推送至 `gh-pages` 分支，GitHub Pages 自动部署：

- 中文：https://lands-1203.github.io/flow-spec/
- 英文：https://lands-1203.github.io/flow-spec/en/

## 与 html-ppt 技能的关系

演示页通过相对路径引用本仓 **`.claude/skills/html-ppt/assets/`** 下的样式与动画资源；若移动演示目录或剥离为独立发布包，须同步调整 `index.html` 中的 `href` 或改为拷贝所需静态资源。

## 维护说明

- 内容迭代：优先改 `index.html` / `style.css`，本 `stock-docs` 仅作**索源与路径约定**摘要。
- 路由：命中主题 `flow-spec-presentations` 时，可先读本文件再按需打开上述源码文件。
