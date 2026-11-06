'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const engine=require('./vendor/engine.cjs');
const {JSZip,DOMParser,XMLSerializer}=engine;
const NS={p:'http://schemas.openxmlformats.org/presentationml/2006/main',a:'http://schemas.openxmlformats.org/drawingml/2006/main',r:'http://schemas.openxmlformats.org/officeDocument/2006/relationships',pr:'http://schemas.openxmlformats.org/package/2006/relationships'};
const children=(n,local)=>Array.from(n.childNodes||[]).filter(x=>x.nodeType===1&&(!local||x.localName===local));
const descendants=(n,ns,local)=>Array.from(n.getElementsByTagNameNS(ns,local));
const serialize=n=>new XMLSerializer().serializeToString(n);
function parse(s){if(/<!DOCTYPE/i.test(s))throw new Error('DTD is unsupported');return new DOMParser().parseFromString(s,'application/xml');}
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const xmlText=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const relPath=owner=>owner?path.posix.join(path.posix.dirname(owner),'_rels',path.posix.basename(owner)+'.rels'):'_rels/.rels';
function resolvePart(owner,target){return decodeURIComponent(path.posix.normalize(target.startsWith('/')?target.slice(1):path.posix.join(path.posix.dirname(owner),target.split('#')[0])));}
async function readXml(zip,part){const file=zip.file(part);if(!file)throw new Error('Missing package part: '+part);return parse(await file.async('string'));}
async function relationships(zip,owner){const f=zip.file(relPath(owner));if(!f)return[];return descendants(parse(await f.async('string')),NS.pr,'Relationship').map(n=>({id:n.getAttribute('Id'),type:n.getAttribute('Type').split('/').pop(),external:n.getAttribute('TargetMode')==='External',target:n.getAttribute('Target'),part:resolvePart(owner,n.getAttribute('Target'))}));}
async function slideEntries(zip){const doc=await readXml(zip,'ppt/presentation.xml');const rels=await relationships(zip,'ppt/presentation.xml');return descendants(doc,NS.p,'sldId').map((n,i)=>{const rel=rels.find(r=>r.id===n.getAttributeNS(NS.r,'id'));if(!rel)throw new Error('Missing slide relationship');return{position:i+1,fileNumber:Number(path.posix.basename(rel.part).match(/slide(\d+)\.xml$/)?.[1]),part:rel.part};});}
function shapeRecords(xml){const root=descendants(xml,NS.p,'spTree')[0];const result=[];function walk(node,parent=[]){for(const n of children(node)){if(!['sp','pic','grpSp','graphicFrame','cxnSp'].includes(n.localName))continue;const nv=descendants(n,NS.p,'cNvPr')[0];const id=nv?.getAttribute('id'),name=nv?.getAttribute('name');result.push({node:n,id,name,kind:n.localName,parent});if(n.localName==='grpSp')walk(n,[...parent,{id,name}]);}}if(root)walk(root);return result;}
function selectShape(xml,selector){const all=shapeRecords(xml);const s=typeof selector==='string'?{name:selector}:selector;const matches=all.filter(r=>(s.id===undefined||r.id===String(s.id))&&(s.name===undefined||r.name===s.name));if(matches.length!==1)throw new Error(`Selector must match exactly once: ${JSON.stringify(selector)}; matched ${matches.length}`);return matches[0].node;}
function paragraphs(node){const tx=children(node,'txBody')[0];return tx?children(tx,'p'):[];}
function textOf(node){return paragraphs(node).map(p=>descendants(p,NS.a,'t').map(t=>t.textContent).join('')).join('\n');}
function setText(node,lines,{language,fontFamily}={}){
  if(typeof lines==='string')lines=lines.split('\n');
  if(!Array.isArray(lines)||!lines.length||lines.some(t=>typeof t!=='string'))throw new Error('paragraphs must contain one or more strings');
  const tx=children(node,'txBody')[0],originals=paragraphs(node);
  if(!tx||!originals.length)throw new Error('Selected object is not an editable text shape/cell');
  const doc=node.ownerDocument;
  const fresh=lines.map((line,i)=>{
    const original=originals[Math.min(i,originals.length-1)];
    const para=original.cloneNode(true),oldRun=descendants(original,NS.a,'r')[0];
    const run=oldRun?oldRun.cloneNode(true):doc.createElementNS(NS.a,'a:r');
    for(const n of children(para))if(!['pPr','endParaRPr'].includes(n.localName))para.removeChild(n);
    for(const n of Array.from(run.childNodes))if(n.nodeType!==1||n.localName!=='rPr')run.removeChild(n);
    let rp=children(run,'rPr')[0];if(!rp){rp=doc.createElementNS(NS.a,'a:rPr');run.appendChild(rp);}
    const t=doc.createElementNS(NS.a,'a:t');t.appendChild(doc.createTextNode(line));run.appendChild(t);
    if(language){rp.setAttribute('lang',language);rp.setAttribute('altLang','en-US');}
    if(fontFamily)for(const local of ['latin','ea']){let font=children(rp,local)[0];if(!font){font=doc.createElementNS(NS.a,'a:'+local);rp.appendChild(font);}font.setAttribute('typeface',fontFamily);}
    let end=children(para,'endParaRPr')[0];if(!end){end=doc.createElementNS(NS.a,'a:endParaRPr');para.appendChild(end);}
    if(language){end.setAttribute('lang',language);end.setAttribute('altLang','en-US');}
    para.insertBefore(run,end);return para;
  });
  originals.forEach(p=>tx.removeChild(p));fresh.forEach(p=>tx.appendChild(p));
}
function setFrame(shape,frame){const props=children(shape,'spPr')[0]||children(shape,'grpSpPr')[0];const xf=props&&children(props,'xfrm')[0];if(!xf)throw new Error('No simple transform on selected shape');const off=children(xf,'off')[0],ext=children(xf,'ext')[0];for(const [key,node,attr]of [['x',off,'x'],['y',off,'y'],['width',ext,'cx'],['height',ext,'cy']])if(frame[key]!==undefined){if(!Number.isInteger(frame[key])||(key==='width'||key==='height')&&frame[key]<=0)throw new Error('Frame must contain integer EMUs');node.setAttribute(attr,String(frame[key]));}}
async function prunePackage(bytes,{title='Presentation',preserveSpeakerNotes=false}={}){
  const zip=await JSZip.loadAsync(bytes);
  // New decks do not silently inherit unrelated source notes or personal metadata.
  for(const name of Object.keys(zip.files).filter(n=>n.endsWith('.rels'))){const doc=await readXml(zip,name);let changed=false;for(const rel of descendants(doc,NS.pr,'Relationship')){const type=rel.getAttribute('Type').split('/').pop();if(type==='thumbnail'||type==='custom-properties'||(!preserveSpeakerNotes&&type==='notesSlide')){rel.parentNode.removeChild(rel);changed=true;}}if(changed)zip.file(name,serialize(doc));}
  zip.file('docProps/core.xml',`<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlText(title)}</dc:title></cp:coreProperties>`);
  const keep=new Set(['[Content_Types].xml']),pending=[''];
  while(pending.length){const owner=pending.pop(),rp=relPath(owner);if(keep.has(rp)||!zip.file(rp))continue;keep.add(rp);for(const rel of await relationships(zip,owner)){if(rel.external)continue;if(!zip.file(rel.part))throw new Error(`Missing reachable target: ${rp} -> ${rel.part}`);if(!keep.has(rel.part)){keep.add(rel.part);pending.push(rel.part);}}}
  const count=(await slideEntries(zip)).length;
  if(zip.file('docProps/app.xml'))zip.file('docProps/app.xml',`<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>pptx-automizer</Application><Slides>${count}</Slides><Notes>${[...keep].filter(n=>/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).length}</Notes><HiddenSlides>0</HiddenSlides></Properties>`);
  const ct=await readXml(zip,'[Content_Types].xml');for(const node of children(ct.documentElement,'Override'))if(!keep.has(node.getAttribute('PartName').replace(/^\//,'')))node.parentNode.removeChild(node);zip.file('[Content_Types].xml',serialize(ct));
  const clean=new JSZip();for(const n of [...keep].sort())clean.file(n,await zip.file(n).async('nodebuffer'));
  return clean.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
module.exports={...engine,fs,path,NS,children,descendants,serialize,parse,sha256,relPath,resolvePart,readXml,relationships,slideEntries,shapeRecords,selectShape,paragraphs,textOf,setText,setFrame,prunePackage};
