const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const cache = new Map();
const storage = new Map();
const localStorage = {getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
function load(file, overrides={}) {
  file=path.resolve(file);
  if(cache.has(file) && !Object.keys(overrides).length)return cache.get(file);
  const exports={};
  const source=fs.readFileSync(file,'utf8');
  let js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  if(file.endsWith(path.join('apartment-bulk','page.tsx')))js+='\nexports.testOnly={makeBodyPrompt,makeThumbnailPrompt,makePriceImagePrompt,priceContext,parseNaverBlog};';
  const loader=name=>{
    if(overrides[name])return overrides[name];
    if(name.endsWith('.css'))return {};
    if(name==='next/server')return {NextResponse:{json:(data,init)=>({data,status:init?.status||200})}};
    if(name.startsWith('@/') || name.startsWith('.')){
      const base=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name);
      const resolved=['.ts','.tsx','.js'].map(ext=>base+ext).find(fs.existsSync);return load(resolved,overrides);
    }
    return require(name);
  };
  vm.runInNewContext(js,{exports,require:loader,console,Date,Intl,Map,Set,URL,localStorage,Blob,TextEncoder},{filename:file});
  if(!Object.keys(overrides).length)cache.set(file,exports);
  return exports;
}
module.exports={load,storage};
