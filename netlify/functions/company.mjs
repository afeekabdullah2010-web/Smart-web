import { getDatabase } from '@netlify/database';
import { getStore } from '@netlify/blobs';
import { createCompany } from '../lib/company.mjs';
import templates from '../lib/templates.mjs';

let database;
export default async (request, context) => {
  try {
  database ||= getDatabase();
  const production=context.deploy?.context==='production';
  const name=production?'smart-power-files-production':'smart-power-files-'+String(context.deploy?.id||'local');
  const handler=createCompany({
    pool:database.pool,
    store:getStore({name,consistency:'strong'}),
    templates,
    env:key=>Netlify.env.get(key)
  });
  return await handler(request);
  } catch (error) {
    console.error("Company runtime unavailable", error.name);
    return Response.json({error:"The database service is not ready. Check the Netlify deploy and database configuration."},{status:503,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
  }
};
