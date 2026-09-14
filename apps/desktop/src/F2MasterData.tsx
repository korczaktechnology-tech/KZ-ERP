import React from 'react';
import { F2MasterDataProfessional } from './F2MasterDataProfessional';
type Session={accessToken:string;refreshToken:string;user?:{role?:string}};
const API=(import.meta.env.VITE_API_URL??'https://kz-erp.onrender.com').replace(/\/$/,'');
function isBinaryBody(body:BodyInit|undefined){return body instanceof Blob||body instanceof ArrayBuffer}
export function F2MasterData({session,onToast}:{session:Session;onToast:(message:string)=>void}){
 const api=React.useCallback(async<T=unknown>(path:string,options:RequestInit={})=>{const headers=new Headers(options.headers);headers.set('Accept','application/json');if(options.body!==undefined&&!isBinaryBody(options.body as BodyInit))headers.set('Content-Type','application/json');headers.set('Authorization',`Bearer ${session.accessToken}`);const response=await fetch(`${API}${path}`,{...options,headers});const body=await response.json().catch(()=>null) as any;if(!response.ok)throw new Error(body?.error?.message??body?.error?.code??`HTTP ${response.status}`);return (body?.data??body) as T},[session.accessToken]);
 return <F2MasterDataProfessional api={api} onToast={onToast}/>;
}
