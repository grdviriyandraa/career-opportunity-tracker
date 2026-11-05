import {owner,json,fail,getRecords,getSettings,getHistory,getIntegration,body,putSettings,backup} from '@/lib/server';
import {getDb} from '@/db';
import {snapshots} from '@/db/schema';
import {eq,desc} from 'drizzle-orm';
import seed from '@/data/migration.json';
export const dynamic='force-dynamic';
export async function GET(){try{const u=await owner(),records=await getRecords(u.userId),settings=await getSettings(u.userId);return json({records,settings,history:await getHistory(u.userId),busy:await getIntegration(u.userId,'busy'),snapshots:await getDb().select({id:snapshots.id,createdAt:snapshots.createdAt,count:snapshots.count}).from(snapshots).where(eq(snapshots.owner,u.userId)).orderBy(desc(snapshots.createdAt)).limit(20),suggestions:(seed as any[]).filter(x=>!records.some(r=>r.id===x.id)&&!settings.ignoredSeeds.includes(x.id)),user:{name:u.displayName,email:u.email}})}catch(e){return fail(e)}}
export async function POST(req:Request){try{const u=await owner(req,true),b=await body(req);if(b.action==='backup')return json(await backup(u.userId));return json({settings:await putSettings(u.userId,b.settings,b.expectedRevision)});}catch(e){return fail(e)}}
