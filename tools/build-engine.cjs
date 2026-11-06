'use strict';
const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..');
const result=esbuild.buildSync({absWorkingDir:root,entryPoints:['tools/engine-entry.cjs'],bundle:true,platform:'node',target:'node20',format:'cjs',outfile:'src/vendor/engine.cjs',minify:true,legalComments:'none',metafile:true});
const packages=new Map();
for(const file of Object.keys(result.metafile.inputs)){
  let dir=path.dirname(path.resolve(root,file));
  while(dir!==path.dirname(dir)){
    const pj=path.join(dir,'package.json');
    if(fs.existsSync(pj)){
      const data=JSON.parse(fs.readFileSync(pj,'utf8'));
      if(dir===root||!data.name)break;
      const key=data.name+'@'+data.version;
      if(!packages.has(key)){
        const names=fs.readdirSync(dir).filter(n=>/^(licen[sc]e|copying|notice)(\.|$)/i.test(n)&&fs.statSync(path.join(dir,n)).isFile());
        let text=names.map(n=>n+'\n'+fs.readFileSync(path.join(dir,n),'utf8')).join('\n\n');
        if(!text&&fs.existsSync(path.join(dir,'README.md'))){const readme=fs.readFileSync(path.join(dir,'README.md'),'utf8');const start=readme.search(/^##? License\s*$/mi);if(start>=0)text=readme.slice(start);}
        if(!text)throw new Error('Missing full license notice for '+key);
        packages.set(key,{name:data.name,version:data.version,license:data.license,text});
      }
      break;
    }
    dir=path.dirname(dir);
  }
}
fs.writeFileSync(path.join(root,'docs/THIRD-PARTY-NOTICES.txt'),[...packages.values()].map(p=>`${p.name}@${p.version}\nDeclared license: ${JSON.stringify(p.license)}\n${p.text}`).join('\n\n'+'='.repeat(72)+'\n\n'));
console.log('Bundled runtime and notices for '+packages.size+' packages');
