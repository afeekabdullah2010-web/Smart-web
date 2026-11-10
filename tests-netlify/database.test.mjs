import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {databaseConfig} from '../netlify/lib/database.mjs';
import {applyMigrations} from '../scripts/migrate-postgres.mjs';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const clientFor=db=>({query:(sql,params)=>params?db.query(sql,params):db.exec(sql).then(results=>results.at(-1)||{rows:[]})});

test('external database configuration requires credentials and verified TLS',()=>{
 assert.throws(()=>databaseConfig(),/DATABASE_URL/);
 assert.throws(()=>databaseConfig('https://example.test'),/PostgreSQL/);
 assert.throws(()=>databaseConfig('postgresql://user:pass@example.test/db?sslmode=disable'),/TLS/);
 const config=databaseConfig('postgresql://user:pass@example.test/db?sslmode=require&channel_binding=require');
 assert.equal(config.ssl.rejectUnauthorized,true);
 assert.equal(config.enableChannelBinding,true);
 assert.equal(new URL(config.connectionString).searchParams.has('sslmode'),false);
 assert.equal(config.max,3);
});

test('external migration runner is repeatable and preserves saved records',async()=>{
 const db=new PGlite();
 try{
  assert.equal(await applyMigrations(clientFor(db)),2);
  await db.query("INSERT INTO sp_users(name,email,role,password_hash,created_at) VALUES('Saved User','saved@example.test','Staff','fixture-only',1)");
  assert.equal(await applyMigrations(clientFor(db)),0);
  assert.equal((await db.query('SELECT name FROM sp_users')).rows[0].name,'Saved User');
  assert.equal((await db.query('SELECT count(*) AS count FROM sp_schema_migrations')).rows[0].count,2);
 }finally{await db.close()}
});

test('changed applied migrations are rejected without resetting data',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sp-migrations-')),db=new PGlite(),url=pathToFileURL(dir+'/');
 const name='20261101180000_company.sql';
 try{
  const sql=await readFile(new URL('../database/migrations/'+name,import.meta.url),'utf8');
  await writeFile(join(dir,name),sql);await applyMigrations(clientFor(db),url);
  await db.query("INSERT INTO sp_users(name,email,role,password_hash,created_at) VALUES('Preserved','kept@example.test','Staff','fixture-only',1)");
  await writeFile(join(dir,name),sql+'\n-- changed\n');
  await assert.rejects(applyMigrations(clientFor(db),url),/changed/);
  assert.equal((await db.query('SELECT name FROM sp_users')).rows[0].name,'Preserved');
 }finally{await db.close();await rm(dir,{recursive:true,force:true})}
});
