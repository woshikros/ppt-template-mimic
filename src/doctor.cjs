'use strict';
const major=Number(process.versions.node.split('.')[0]);
if(major<20){console.error('Requires Node.js 20 or newer. Use an available runtime; do not install software without authorization.');process.exitCode=1;}
else{const{engineVersion,Automizer,JSZip,DOMParser}=require('./vendor/engine.cjs');if(!Automizer||!JSZip||!DOMParser)throw new Error('Engine bundle incomplete');console.log(JSON.stringify({node:process.versions.node,pptxAutomizer:engineVersion,networkRequired:false,externalNpmPackagesRequired:false,visualReview:'Windows: existing PowerPoint + PowerShell. Other environments: an available rendering tool is required.'},null,2));}
