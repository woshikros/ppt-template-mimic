#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const help=`ppt-template-mimic (Node.js 20+)

  doctor
  inspect <reference.pptx> <analysis-directory>
  build <spec.json> <new-output.pptx>
  verify <output.pptx> [expected-slide-count]

No npm install is needed for these commands. Render the output separately
and inspect each slide before calling the deck visually verified.
`;
async function main(){
  const[command,...args]=process.argv.slice(2);
  if(!command||command==='--help'||command==='-h'){console.log(help);return;}
  if(Number(process.versions.node.split('.')[0])<20)throw new Error('Node.js 20 or newer is required');
  if(command==='doctor'&&args.length===0){require('../src/doctor.cjs');return;}
  if(command==='inspect'&&args.length===2){await require('../src/inspect.cjs').inspect(...args);return;}
  if(command==='build'&&args.length===2){await require('../src/build.cjs').build(...args);return;}
  if(command==='verify'&&(args.length===1||args.length===2)){
    const expected=args[1]===undefined?undefined:Number(args[1]);
    if(expected!==undefined&&(!Number.isInteger(expected)||expected<1))throw new Error('Expected slide count must be a positive integer');
    const result=await require('../src/verify.cjs').verify(fs.readFileSync(args[0]),expected);
    console.log(JSON.stringify(result,null,2));if(result.errors.length)process.exitCode=1;return;
  }
  console.error(help);process.exitCode=2;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
