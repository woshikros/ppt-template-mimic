# 制作规格

运行目录不必是项目目录，命令中的脚本、输入、输出路径可以用已解析的绝对路径。`source` 相对规格文件所在目录解析。输出必须为新文件，禁止与参考稿同路径，也不会覆盖已存在的输出。

```json
{
  "source": "reference.pptx",
  "title": "方案示例",
  "language": "zh-CN",
  "totalSlides": 3,
  "slides": [
    {"sourceSlide": 1, "texts": [
      {"selector": {"id": "3", "name": "标题"}, "paragraphs": ["方案示例"]}
    ]},
    {"sourceSlide": 2, "tables": [
      {"index": 0, "rows": [["维度", "方式"], ["协作", "共同评审"]]}
    ]},
    {"sourceSlide": 3, "texts": []}
  ]
}
```

上例仅说明字段，不保证任意模板恰有这些对象。必须先运行 inspect，再使用真实对象 id/名称、列数、页面文件编号；`examples/spec.example.json` 同样不能直接套到未知模板。

字段：

- `language`：可省略保留原语言；支持 `zh-CN`、`zh-TW`、`en-US`。
- `preserveSpeakerNotes`：默认 false，true 仅在用户要求保留原备注时填写。
- `slides[].sourceSlide`：`inventory.json` 中的 `fileNumber`，不是 display position。可以重复复用同一页。
- `texts[].selector`：名称字符串，或含 `id` / `name` 的对象。匹配必须唯一；选择组合内的单个文字对象同样有效。
- `texts[].paragraphs`：字符串数组，每个元素为一段；空内容用 `[""]`。各段继承对应原段样式，新增段继承末段；不会保留原段中的全部混合 run。
- `texts[].fontFamily`：可选，仅使用已确认的参考字体，同时设置 Latin 和 EA。
- `texts[].frame`：可选 `{x,y,width,height}`，单位为 EMU（1 英寸=914400）。仅修改简单文本形状/组合的外框；组合子对象使用其局部坐标，不自动换算。保持坐标空间及整体比例，不能用于原生表格改列宽。
- `tables[].index`：当前页原生表格 0 起始索引。
- `tables[].rows`：矩形字符串数组，列数须与原稿一致；可以减少或增加行。合并单元格通用路径拒绝处理。
- `tables[].rowHeights`：可选，正整数 EMU，总和须等于原表总高度；省略则保留表头高度并均分正文剩余高度。缩为一行时使用原总高度。
- `tables[].bodyFontPt` / `headerFontPt`：可选字号；省略保留原字号。`fontFamily` 同文字操作。默认继承每个单元格原有颜色和加粗，若旧颜色含“支持/不支持”等业务语义，要在专门适配中重新映射，不能机械保留造成误读。

不支持的变更：跨模板合并、复杂合并表格编辑、新增原生图表、任意代码回调和结构不同的新流程图，不伪装成字段能力。需要时以当前 engine 的 `Automizer` API 编写独立适配脚本，先核对官方说明并测试；保留同样的只读参考、输出清理、结构校验和视觉核对要求。
