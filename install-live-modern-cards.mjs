export function patchLiveServer(input) {
  let source=input;
  const replaceOnce=(before,after)=>{
    if(source.split(before).length!==2) throw Error("Live source differs; expected one occurrence: "+before.slice(0,90));
    source=source.replace(before,after);
  };
  const marker='import { isManualRecipeCardRequest } from "./recipe-card-policy.mjs";';
  if(source.includes(marker)) {
    if(!source.includes('const generatorFile = "render-modern-recipe-card.mjs";')) throw Error("Partial installation requires review");
    return {source,changed:false};
  }
  replaceOnce('import sharp from "sharp";','import sharp from "sharp";\n'+marker);
  replaceOnce('    // All admin card generation must use the approved Karnıyarık master.\n    // The legacy AI visual-base generator produces a different card design and\n    // must not be reachable from the production queue.\n    const generatorFile = "render-master-reference-karniyarik-card.mjs";','    // Explicit admin card requests use the Modern Menemen layout.\n    const generatorFile = "render-modern-recipe-card.mjs";');
  replaceOnce('function queueRecipeCardGeneration(recipeIds, { force = false, reason = "automatic", languages = RECIPE_CARD_PRODUCTION_LANGUAGES } = {}) {','function queueRecipeCardGeneration(recipeIds, { force = false, reason = "automatic", languages = RECIPE_CARD_PRODUCTION_LANGUAGES } = {}) {\n  if (!isManualRecipeCardRequest(reason)) return { added:0, skipped:0, automaticGenerationDisabled:true };');
  replaceOnce('      const job = queue[index];\n      job.status = "running";','      const job = queue[index];\n      if (!isManualRecipeCardRequest(job.reason)) {\n        job.status = "cancelled";\n        job.cancelledAt = new Date().toISOString();\n        job.updatedAt = job.cancelledAt;\n        job.error = "";\n        writeRecipeCardGenerationQueue(queue);\n        continue;\n      }\n      job.status = "running";');
  replaceOnce('      if (updatedApprovedRecipes.length && !managedTransferProcessed) {\n        queueRecipeCardGeneration(updatedApprovedRecipes.map(recipe => recipe.id), {\n          force:true,\n          reason:"approved-excel-import"\n        });\n      }','      // Excel imports do not start card production.');
  replaceOnce('    queueRecipeCardGeneration([approvedRecipe.id], {\n      reason:"recipe-approved"\n    });','    // Recipe approval does not start card production.');
  replaceOnce('/card localization validation failed|recipe localization failed|recipe translation semantic validation failed/i','/card layout validation failed|card localization validation failed|recipe localization failed|recipe translation semantic validation failed/i');
  const pattern='[r]ender-master-reference-karniyarik-card.mjs|[g]enerate-reference-recipe-card.mjs';
  if(source.split(pattern).length!==3)throw Error("Unexpected orphan generator configuration");
  source=source.replaceAll(pattern,'[r]ender-modern-recipe-card.mjs|'+pattern);
  return {source,changed:true};
}

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
const RELEASE="ec7ff9e7043585f169f959ad71a8277d494fb6cb";
export async function installLiveCards({apply=false}={}) {
 const root=fs.realpathSync(process.cwd());
 if(root!=="/var/www/niliskitchen")throw Error("Run only from /var/www/niliskitchen");
 const serverFile=path.join(root,"server.js");
 const original=fs.readFileSync(serverFile,"utf8");
 const patched=patchLiveServer(original);
 if(!patched.changed){console.log("Already installed; no files changed.");return;}
 const stage=fs.mkdtempSync(path.join(os.tmpdir(),"nili-modern-cards-"));
 const codeFiles=["recipe-card-policy.mjs","modern-recipe-card-layout.mjs","render-modern-recipe-card.mjs","recipe-card-policy.test.mjs","modern-recipe-card-layout.test.mjs"];
 const assetFiles=["logo-transparent.png","assets/fonts/Baloo2-Variable.ttf","assets/fonts/Caveat-Variable.ttf","assets/fonts/NotoSansCJKjp-Bold.otf","assets/fonts/NotoSansCJKsc-Bold.otf"];
 const files=[...codeFiles,...assetFiles.filter(f=>!fs.existsSync(path.join(root,f)))];
 for(const name of files) {
   const response=await fetch("https://raw.githubusercontent.com/Didi1967/Nili-s-Kitchen/"+RELEASE+"/"+name,{signal:AbortSignal.timeout(60000)});
   if(!response.ok)throw Error("Download failed: "+name+" HTTP "+response.status);
   const bytes=Buffer.from(await response.arrayBuffer());
   if(!bytes.length)throw Error("Empty file: "+name);
   fs.mkdirSync(path.dirname(path.join(stage,name)),{recursive:true});
   fs.writeFileSync(path.join(stage,name),bytes);
 }
 fs.writeFileSync(path.join(stage,"server.js"),patched.source);
 for(const name of ["server.js",...codeFiles]){
   const check=spawnSync(process.execPath,["--check",path.join(stage,name)],{encoding:"utf8"});
   if(check.status!==0)throw Error("Syntax check failed: "+name+"\n"+check.stderr);
 }
 const tests=spawnSync(process.execPath,["--test",path.join(stage,"recipe-card-policy.test.mjs"),path.join(stage,"modern-recipe-card-layout.test.mjs")],{encoding:"utf8"});
 console.log(tests.stdout);
 if(tests.status!==0)throw Error("Tests failed:\n"+tests.stderr);
 if(!apply){console.log("DRY RUN OK. Existing live fixes preserved. Run with --apply to install.");return;}
 // Refuse a source that changed while files were being staged.
 if(fs.readFileSync(serverFile,"utf8")!==original)throw Error("Live server changed during staging; retry after review.");
 const backup=path.join(root,"deploy-backups","modern-cards-"+new Date().toISOString().replace(/[:.]/g,"-"));
 fs.mkdirSync(backup,{recursive:true,mode:0o700});
 const installFiles=[...files,"server.js"];
 const existed=[];
 for(const name of installFiles){
   const target=path.join(root,name);
   if(fs.existsSync(target)){
     fs.mkdirSync(path.dirname(path.join(backup,name)),{recursive:true});
     fs.copyFileSync(target,path.join(backup,name));
     existed.push(name);
   }
 }
 const controlFile=path.join(root,"recipe-posters","generation-control.json");
 const oldControl=fs.existsSync(controlFile)?fs.readFileSync(controlFile):null;
 if(oldControl)fs.writeFileSync(path.join(backup,"generation-control.json"),oldControl);
 fs.writeFileSync(path.join(backup,"installation.json"),JSON.stringify({release:RELEASE,files:installFiles,existed},null,2));
 const writeAtomic=(file,bytes)=>{
   fs.mkdirSync(path.dirname(file),{recursive:true});
   const temp=file+".modern-install-"+process.pid;
   fs.writeFileSync(temp,bytes);fs.renameSync(temp,file);
 };
 const installed=[];
 try{
   // Leave production paused until an admin explicitly starts a small sample.
   writeAtomic(controlFile,JSON.stringify({paused:true,code:"MANUAL",reason:"Modern card installation: start a sample explicitly from admin.",updatedAt:new Date().toISOString()}));
   for(const name of installFiles){writeAtomic(path.join(root,name),fs.readFileSync(path.join(stage,name)));installed.push(name);}
 }catch(error){
   for(const name of installed.reverse()){
     const target=path.join(root,name);
     if(existed.includes(name))writeAtomic(target,fs.readFileSync(path.join(backup,name)));
     else fs.unlinkSync(target);
   }
   if(oldControl)writeAtomic(controlFile,oldControl);
   throw error;
 }
 // Stop only detached legacy card generators, never the API process.
 const stopped=spawnSync("pkill",["-TERM","-f","[r]ender-master-reference-karniyarik-card.mjs|[g]enerate-reference-recipe-card.mjs"],{encoding:"utf8"});
 if(![0,1].includes(stopped.status))console.warn("Legacy generator stop needs manual verification.");
 console.log("INSTALLED. Backup: "+backup);
 console.log("No recipe JSON, uploads, credentials, package files or PM2 configuration were replaced.");
 console.log("Next: pm2 restart niliskitchen-api");
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 installLiveCards({apply:process.argv.includes("--apply")}).catch(error=>{console.error(error.message);process.exitCode=1});
}
