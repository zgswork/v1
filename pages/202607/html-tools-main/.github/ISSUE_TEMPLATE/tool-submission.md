---
name: 工具提交
about: 提交一个新的 HTML 工具到 JustHTMLs
title: '[工具提交] 工具名称'
labels: ['tool-submission']
assignees: []
---

## 工具信息

### 基本信息
- **工具 ID**: `工具的唯一标识符，使用小写字母和连字符，如 json-to-yaml`
- **工具名称**: `工具的显示名称`
- **分类**: `从以下分类中选择一个：converter / developer / text / image / utility`
- **标签**: `3-5个相关标签，用逗号分隔`

### 描述
- **简短描述**: `一句话描述工具功能`
- **详细描述**:
  ```
  详细说明工具的用途、特点和适用场景
  ```

### 视觉设计
- **图标**: `选择一个 Emoji 作为工具图标，如 🔄`
- **主题颜色**: `主题颜色代码，如 #6366f1`

### 作者信息
- **作者名称**: `你的名字`
- **GitHub 用户名**: `@yourusername`
- **个人网站**: `可选，你的个人网站或博客链接`

---

## 工具代码

### 方式一：直接粘贴代码（推荐用于小型工具）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>工具名称</title>
    <style>
        /* 内联 CSS */
    </style>
</head>
<body>
    <!-- HTML 结构 -->
    <script>
        // JavaScript 代码
    </script>
</body>
</html>
```

### 方式二：GitHub Gist（推荐用于大型工具）
- **Gist 链接**: `https://gist.github.com/yourusername/gist-id`

### 方式三：个人仓库（需公开）
- **仓库链接**: `https://github.com/yourusername/tool-repo`

---

## 审核清单

请确保你的工具符合以下要求：

- [ ] 工具是单文件 HTML（所有 CSS/JS 都内联在文件中）
- [ ] 不使用 React 或其他需要构建步骤的技术
- [ ] 如需第三方库，从 CDN 加载
- [ ] 代码量控制在合理范围内（建议 500 行以内）
- [ ] 工具在浏览器中可以直接打开运行
- [ ] 工具功能完整，无明显 Bug
- [ ] UI 设计美观，用户体验良好
- [ ] 不包含恶意代码或隐私窃取行为
- [ ] 我同意将代码以 MIT 许可证发布

---

## 补充说明

`任何其他需要说明的信息，如工具的特殊功能、使用注意事项等`

---

**感谢你的贡献！我们会尽快审核你的提交。如有问题，我们会通过 Issue 与你联系。**

💡 **提示**: 你也可以先加入 [JustHTMLs 组织](https://github.com/justhtmls) 成为成员，直接提交 PR 到 justhtmls/html-tools。
