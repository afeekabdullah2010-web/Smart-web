import pg from 'pg';
import { databaseConfig } from '../lib/database.mjs';
import { getStore } from '@netlify/blobs';
import { createCompany } from '../lib/company.mjs';
import templates from '../lib/templates.mjs';

let pool;
export default async (request, context) => {
  const deployContext=context.deploy?.context;
  if(deployContext && deployContext!=='production' && Netlify.env.get('SMART_POWER_PREVIEW_DATABASE')!=='isolated'){
    return Response.json({error:'Preview company access is disabled until an isolated preview database is configured.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
  try {
  pool ||= new pg.Pool(databaseConfig(Netlify.env.get('DATABASE_URL')));
  const production=context.deploy?.context==='production';
  const name=production?'smart-power-files-production':'smart-power-files-'+String(context.deploy?.id||'local');
  const handler=createCompany({
    pool,
    store:getStore({name,consistency:'strong'}),
    templates,
    env:key=>Netlify.env.get(key)
  });
  return await handler(request);
  } catch (error) {
    console.error("Company runtime unavailable", error.name);
    return Response.json({error:"The external database is not connected. Check DATABASE_URL and the database migration status."},{status:503,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }
};
