# 渲染与检查

结构检查不能替代视觉检查，也不等于完整 OOXML 标准认证。内置 verify 检查页数、资源关系、对象 id 唯一性和矩形表格结构；不检查商业事实、动画播放、字形替代或视觉审美。

Windows 有已安装的桌面版 PowerPoint 时，在当前平台权限允许下执行：

```powershell
& "<项目目录>/scripts/render-powerpoint.ps1" -InputPptx "reference.pptx" -OutputDirectory "reference-preview"
& "<项目目录>/scripts/render-powerpoint.ps1" -InputPptx "new-deck.pptx" -OutputDirectory "output-preview"
```

脚本只读打开并逐页导出 PNG，不修改原件，不结束其他 PowerPoint 进程。COM 被权限限制时，遵循运行环境批准流程，不自行提升权限或改系统设置。

其他环境若已有 LibreOffice 和 Poppler，可使用现成工具：

```text
soffice -env:UserInstallation=file:///独立临时目录/lo-profile --headless --convert-to pdf --outdir previews new-deck.pptx
pdftoppm -png -r 120 previews/new-deck.pdf previews/slide
```

独立 profile 的 URI 必须按本机路径正确编码。Windows/macOS/Linux 的字体可能不同；渲染前确认参考字体是否存在，不擅自把缺失字体视为已保留。优先用本机已有 Office 渲染能力；不要求必须存在其他 Skill 的私有脚本路径。工具缺失只阻塞依赖它的检查，不能安装未经授权的软件。

检查每一页：

1. 总页数与顺序准确，示例内容有标识，没有原稿残留的对象正文或过期日期。
2. 画幅与参考一致，Logo、背景、固定装饰、页脚保留，比例和裁剪不变。
3. 标题没有压住 Logo，中文没有孤字折行，正文、表格和图形没有溢出或遮挡。
4. 组合的箭头、图标、颜色层级、对齐与原页一致；流程连接逻辑符合新内容。
5. 表格行列完整，数字和单位正确，颜色不沿用错误的业务含义；图表与表格仍是用户要求的可编辑对象。
6. 最终交付的文件与已渲染版本相同，参考原件的哈希未变化。

修复后重新渲染受影响页。完成必要检查即交付，不因个人审美无限返工。最终报告如实区分“结构检查完成”“视觉检查完成”“已在 PowerPoint 打开”，不能混为一谈。
