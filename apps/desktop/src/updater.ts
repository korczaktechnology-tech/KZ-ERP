import { invoke } from '@tauri-apps/api/core';

const UPDATE_API = import.meta.env.VITE_UPDATE_API_URL ?? import.meta.env.VITE_API_URL ?? 'https://kz-erp-api.onrender.com';
const CURRENT_VERSION = '0.1.0';
function versionParts(v:string){return v.replace(/^v/,'').split('.').map(n=>Number.parseInt(n,10)||0)}
function isNewer(remote:string,local:string){const a=versionParts(remote),b=versionParts(local);for(let i=0;i<3;i++){if((a[i]??0)!==(b[i]??0))return(a[i]??0)>(b[i]??0)}return false}
export async function checkForUpdate(setStatus:(s:string)=>void){
  try{
    setStatus('Verificando atualizações…');
    const r=await fetch(`${UPDATE_API}/api/v1/updates/latest`,{cache:'no-store'});if(!r.ok)throw new Error(`update ${r.status}`);
    const release=await r.json() as {version:string;assetId:number;sha256:string};
    if(!isNewer(release.version,CURRENT_VERSION)){setStatus('Atualizado');return}
    setStatus(`Atualização ${release.version} disponível`);
    await invoke('install_update',{assetUrl:`${UPDATE_API}/api/v1/updates/asset/${release.assetId}`,version:release.version,expectedSha256:release.sha256});
  }catch(e){console.warn('Updater:',e);setStatus('Atualização indisponível')}
}
