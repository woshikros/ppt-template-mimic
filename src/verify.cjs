'use strict';
const c=require('./common.cjs');
const {fs,path,JSZip,NS,descendants,children,readXml,relationships,slideEntries,relPath,resolvePart}=c;
async function verify(bytes,expected){
  const zip=await JSZip.loadAsync(bytes),entries=await slideEntries(zip),errors=[];let nativeTables=0;
  if(expected!==undefined&&entries.length!==expected)errors.push('Unexpected active slide count');
  for(const name of Object.keys(zip.files).filter(n=>!zip.files[n].dir&&n.endsWith('.xml')))await readXml(zip,name);
  for(const name of Object.keys(zip.files).filter(n=>n.endsWith('.rels'))){
    const owner=name==='_rels/.rels'?'':path.posix.join(path.posix.dirname(path.posix.dirname(name)),path.posix.basename(name).slice(0,-5));
    if(owner&&!zip.file(owner))errors.push('Orphan relationship file: '+name);
    const doc=await readXml(zip,name);for(const rel of descendants(doc,NS.pr,'Relationship'))if(rel.getAttribute('TargetMode')!=='External'&&!zip.file(resolvePart(owner,rel.getAttribute('Target'))))errors.push('Missing target in '+name);
  }
  const details=[];
  for(const entry of entries){const xml=await readXml(zip,entry.part),ids=descendants(xml,NS.p,'cNvPr').map(n=>n.getAttribute('id'));if(new Set(ids).size!==ids.length)errors.push('Duplicate shape ids in '+entry.part);const tables=descendants(xml,NS.a,'tbl');nativeTables+=tables.length;
    for(const table of tables){const cols=children(children(table,'tblGrid')[0],'gridCol').length;for(const row of children(table,'tr')){const cells=children(row,'tc');if(cells.length!==cols&&!cells.some(tc=>tc.hasAttribute('gridSpan')))errors.push('Table column mismatch in '+entry.part);}}
    details.push({position:entry.position,editableShapes:descendants(xml,NS.p,'sp').length,groups:descendants(xml,NS.p,'grpSp').length,nativeTables:tables.length});
  }
  return{slides:entries.length,nativeTables,details,errors,checks:'Package relationships, slide count, editable objects and rectangular table structure; visual correctness requires rendering.'};
}
if(require.main===module){const[file,count]=process.argv.slice(2);if(!file){console.error('Usage: node verify.cjs output.pptx [expected-count]');process.exitCode=2;}else verify(fs.readFileSync(file),count===undefined?undefined:Number(count)).then(r=>{console.log(JSON.stringify(r,null,2));if(r.errors.length)process.exitCode=1;}).catch(e=>{console.error(e.stack);process.exitCode=1;});}
module.exports={verify};
