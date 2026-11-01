// Shared TLS-verified configuration for Neon or another hosted PostgreSQL service.
export function databaseConfig(value){
 if(!value)throw new Error('DATABASE_URL is required. Add the external PostgreSQL connection string in Netlify Environment variables.');
 let url;try{url=new URL(value)}catch{throw new Error('DATABASE_URL must be a valid PostgreSQL connection string.')}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!url.hostname||!url.username||!url.password||url.pathname.length<2)throw new Error('DATABASE_URL must include the PostgreSQL host, database, user and password.');
 if(['disable','allow','prefer'].includes(url.searchParams.get('sslmode')))throw new Error('The hosted database connection must require TLS.');
 // pg connection-string SSL parameters overwrite the ssl object. Keep certificate
 // verification explicit rather than accepting sslmode=require's legacy defaults.
 if(['sslcert','sslkey','sslrootcert'].some(k=>url.searchParams.has(k)))throw new Error('Custom TLS certificate URLs are not supported. Use the provider standard TLS connection string.');
 url.searchParams.delete('sslmode');
 return {connectionString:url.toString(),ssl:{rejectUnauthorized:true},enableChannelBinding:true,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:15000};
}
