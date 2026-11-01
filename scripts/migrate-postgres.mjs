import pg from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {databaseConfig} from '../netlify/lib/database.mjs';

export async function applyMigrations(client,directory=new URL('../database/migrations/',import.meta.url)){
 const files=(await readdir(directory)).filter(n=>/^\d+_[a-z0-9_-]+\.sql$/.test(n)).sort();
 await client.query('BEGIN');
 try{
  await client.query('SELECT pg_advisory_xact_lock(197702)');
  await client.query('CREATE TABLE IF NOT EXISTS sp_schema_migrations(name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const {rows}=await client.query('SELECT name,checksum FROM sp_schema_migrations ORDER BY name');
  if(rows.some(row=>!files.includes(row.name)))throw new Error('An applied migration is missing from the repository. Restore it before deploying.');
  let applied=0;
  for(const name of files){
   const sql=await readFile(new URL(name,directory),'utf8');
   const checksum=createHash('sha256').update(sql).digest('hex'),existing=rows.find(row=>row.name===name);
   if(existing){if(existing.checksum!==checksum)throw new Error('An applied migration was changed: '+name);continue}
   if(rows.some(row=>row.name>name))throw new Error('Migration order is invalid: '+name);
   await client.query(sql);
   await client.query('INSERT INTO sp_schema_migrations(name,checksum) VALUES($1,$2)',[name,checksum]);
   applied++;
  }
  await client.query('COMMIT');return applied;
 }catch(error){await client.query('ROLLBACK');throw error}
}

async function main(){
 if(process.argv.includes('--netlify-build')&&process.env.CONTEXT&&process.env.CONTEXT!=='production'){
  console.log('Preview build: external database migrations are not applied. Configure an isolated preview DATABASE_URL before testing the app.');return;
 }
 const client=new pg.Client(databaseConfig(process.env.DATABASE_URL));
 try{await client.connect();const applied=await applyMigrations(client);console.log('External PostgreSQL schema ready; '+applied+' migration(s) applied.');}
 catch(error){console.error('External PostgreSQL migration failed. Check DATABASE_URL, TLS/network access and database permissions. Code: '+(error.code||error.name));process.exitCode=1;}
 finally{await client.end().catch(()=>{})}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)main().catch(()=>{console.error('DATABASE_URL is missing or invalid. Configure it as a Netlify secret with Builds and Functions scopes.');process.exitCode=1});
