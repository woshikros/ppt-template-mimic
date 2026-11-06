'use strict';
const c=require('./common.cjs');
const {fs,path,Automizer,NS,descendants,children,selectShape,setText,setFrame,sha256,prunePackage}=c;
function applyTable(xml,op,language){
  const table=descendants(xml,NS.a,'tbl')[op.index];if(!table)throw new Error('Native table index not found');
  if(!Array.isArray(op.rows)||!op.rows.length)throw new Error('Table rows cannot be empty');
  const existing=children(table,'tr'),cols=children(children(table,'tblGrid')[0],'gridCol').length;
  if(op.rows.some(r=>!Array.isArray(r)||r.length!==cols||r.some(v=>typeof v!=='string')))throw new Error('Every table row must have the original column count and string values');
  for(const tr of existing)for(const tc of children(tr,'tc'))if(tc.hasAttribute('gridSpan')||tc.hasAttribute('rowSpan')||tc.getAttribute('hMerge')==='1'||tc.getAttribute('vMerge')==='1')throw new Error('Merged table cells need a tailored adapter; generic resizing is refused');
  const total=existing.reduce((sum,r)=>sum+Number(r.getAttribute('h')),0),header=Number(existing[0].getAttribute('h'));
  const rows=op.rows.map((_,i)=>existing[Math.min(i,existing.length-1)].cloneNode(true));
  existing.forEach(r=>table.removeChild(r));
  const heights=op.rowHeights;
  if(heights&&(!Array.isArray(heights)||heights.length!==rows.length||heights.some(n=>!Number.isInteger(n)||n<=0)||heights.reduce((a,b)=>a+b,0)!==total))throw new Error('rowHeights must be positive integer EMUs and preserve original total height');
  const rest=Math.floor((total-header)/Math.max(1,rows.length-1));
  rows.forEach((row,i)=>{
    const height=heights?heights[i]:rows.length===1?total:i===0?header:i===rows.length-1?total-header-rest*(rows.length-2):rest;
    row.setAttribute('h',String(height));const cells=children(row,'tc');
    op.rows[i].forEach((value,j)=>{const cell=cells[j];setText(cell,[value],{language,fontFamily:op.fontFamily});const size=i===0?op.headerFontPt:op.bodyFontPt;
      if(size!==undefined&&(!Number.isFinite(size)||size<1||size>200))throw new Error('Invalid table font size');
      if(size!==undefined)for(const rp of [...descendants(cell,NS.a,'rPr'),...descendants(cell,NS.a,'endParaRPr')])rp.setAttribute('sz',String(Math.round(size*100)));
    });table.appendChild(row);
  });
}
async function build(specFile,output){
  const base=path.dirname(path.resolve(specFile)),spec=JSON.parse(fs.readFileSync(specFile,'utf8'));
  const source=path.resolve(base,spec.source),target=path.resolve(output);
  if(source===target)throw new Error('Output must not overwrite the reference');
  if(fs.existsSync(target))throw new Error('Output exists; choose a new filename');
  if(!Array.isArray(spec.slides)||!spec.slides.length)throw new Error('slides cannot be empty');
  if(!Number.isInteger(spec.totalSlides)||spec.totalSlides!==spec.slides.length)throw new Error('totalSlides must equal slides.length');
  if(spec.language&&!['zh-CN','zh-TW','en-US'].includes(spec.language))throw new Error('Unsupported language: use zh-CN, zh-TW or en-US, or omit');
  const before=fs.readFileSync(source),sourceHash=sha256(before);
  const ppt=new Automizer({templateDir:base,outputDir:path.dirname(target),removeExistingSlides:true,autoImportSlideMasters:true,cleanup:true,cleanupPlaceholders:false,verbosity:0});
  ppt.loadRoot(before).load(before,'reference');
  for(const plan of spec.slides){
    if(!Number.isInteger(plan.sourceSlide)||plan.sourceSlide<1)throw new Error('sourceSlide is the fileNumber from inventory.json');
    ppt.addSlide('reference',plan.sourceSlide,slide=>slide.modify(xml=>{
      for(const op of plan.texts||[]){const shape=selectShape(xml,op.selector);setText(shape,op.paragraphs,{language:spec.language,fontFamily:op.fontFamily});if(op.frame)setFrame(shape,op.frame);}
      for(const op of plan.tables||[])applyTable(xml,op,spec.language);
    }));
  }
  const zip=await ppt.getJSZip();
  const raw=await zip.generateAsync({type:'nodebuffer'});
  const final=await prunePackage(raw,{title:spec.title,preserveSpeakerNotes:spec.preserveSpeakerNotes===true});
  if(sha256(fs.readFileSync(source))!==sourceHash)throw new Error('Reference changed during build');
  const {verify}=require('./verify.cjs');const report=await verify(final,spec.totalSlides);
  if(report.errors.length)throw new Error(JSON.stringify(report.errors));
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,final);
  fs.writeFileSync(target+'.build.json',JSON.stringify({engine:'pptx-automizer',engineVersion:c.engineVersion,sourceSha256:sourceHash,outputSha256:sha256(final),referenceSlides:spec.slides.map(s=>s.sourceSlide),...report,visualReview:'pending; render and inspect every slide before delivery'},null,2));
  console.log(JSON.stringify({output:target,slides:report.slides,sourceUnchanged:true,nativeTables:report.nativeTables}));return target;
}
if(require.main===module){const[spec,output]=process.argv.slice(2);if(!spec||!output){console.error('Usage: node build.cjs spec.json output.pptx');process.exitCode=2;}else build(spec,output).catch(e=>{console.error(e.stack);process.exitCode=1;});}
module.exports={build,applyTable};
