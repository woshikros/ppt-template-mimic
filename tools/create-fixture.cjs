'use strict';
// Creates only synthetic test content. No user/company template is included.
const fs=require('node:fs'),path=require('node:path');
const PptxGenJS=require('pptxgenjs');
const c=require('../src/common.cjs');
async function main(){
  const ppt=new PptxGenJS();ppt.layout='LAYOUT_WIDE';ppt.author='Synthetic fixture';ppt.subject='Automated test data';ppt.title='Template test';ppt.company='';
  let slide=ppt.addSlide();slide.addText('Reference title',{x:1,y:1,w:10,h:1,fontSize:32,color:'245A81',objectName:'Title'});slide.addText('Reference body',{x:1,y:3,w:10,h:1,fontSize:18,objectName:'Body'});
  slide=ppt.addSlide();slide.addText('Table',{x:1,y:0.3,w:10,h:0.6,fontSize:28,objectName:'Title'});slide.addTable([['Item','Status'],['A','Ready'],['B','Review']],{x:1,y:1.5,w:10,h:3,fontSize:16,border:{pt:1,color:'AAAAAA'},objectName:'DataTable'});
  slide=ppt.addSlide();slide.addText('Grouped title',{x:1,y:1,w:10,h:0.8,fontSize:28,objectName:'GroupedTitle'});slide.addText('First',{x:1,y:3,w:4,h:0.8,objectName:'Repeated'});slide.addText('Second',{x:7,y:3,w:4,h:0.8,objectName:'Repeated'});
  const zip=await c.JSZip.loadAsync(await ppt.write({outputType:'nodebuffer'}));
  const xml=await c.readXml(zip,'ppt/slides/slide3.xml'),tree=c.descendants(xml,c.NS.p,'spTree')[0],group=xml.createElementNS(c.NS.p,'p:grpSp');
  const parsed=c.parse(`<p:grpSp xmlns:p="${c.NS.p}" xmlns:a="${c.NS.a}"><p:nvGrpSpPr><p:cNvPr id="1000" name="ExampleGroup"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/><a:chOff x="0" y="0"/><a:chExt cx="12192000" cy="6858000"/></a:xfrm></p:grpSpPr></p:grpSp>`);
  for(const node of c.children(parsed.documentElement))group.appendChild(xml.importNode(node,true));
  for(const shape of c.children(tree).filter(n=>n.localName==='sp'))group.appendChild(shape);
  tree.appendChild(group);zip.file('ppt/slides/slide3.xml',c.serialize(xml));
  const dest=path.resolve(__dirname,'../tests/fixtures/reference.pptx');fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));console.log(dest);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
