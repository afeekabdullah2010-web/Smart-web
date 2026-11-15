"""Read an owner's EAS Android build and download its official artifact for local verification.
No APK is uploaded to a third-party scanning service. Never prints signed download URLs.
"""
import hashlib,json,os,re,urllib.request,urllib.parse,urllib.error,uuid,zipfile
from pathlib import Path
BUILD_ID=str(uuid.UUID(os.environ.get('EXPO_BUILD_ID','57e311ac-a61b-44f6-ba6e-8fc1015e9781')))
PROJECT_ID='46643a71-a257-4649-b510-18b21a89fbfd'
OUT=Path('apk-verification');OUT.mkdir(exist_ok=True)
query='''query BuildForVerification($buildId: ID!) { build { byId(buildId: $buildId) { id status platform gitCommitHash appVersion appBuildVersion app { id } artifacts { buildUrl applicationArchiveUrl } } } }'''
request=urllib.request.Request('https://api.expo.dev/graphql',data=json.dumps({'query':query,'variables':{'buildId':BUILD_ID}}).encode(),headers={'Content-Type':'application/json','User-Agent':'SmartPower-owned-APK-verification/1.0'})
try:
 with urllib.request.urlopen(request,timeout=60) as response:data=json.load(response)
except urllib.error.HTTPError as error:
 try:
  failure=json.loads(error.read());messages='; '.join(str(item.get('message',''))[:180] for item in failure.get('errors',[]))
 except Exception:messages=''
 summary='EAS returned HTTP '+str(error.code)+('. '+messages if messages else '')
 (OUT/'verification-incomplete.json').write_text(json.dumps({'buildId':BUILD_ID,'apkVerified':False,'reason':summary},indent=2)+'\n')
 raise SystemExit(summary+' No APK verification completed; the original APK file may be required.')
except Exception as error:
 raise SystemExit('Unable to read the EAS build. No APK verification completed. '+type(error).__name__)
if data.get('errors'):
 messages='; '.join(str(e.get('message','Access denied'))[:180] for e in data['errors'])
 raise SystemExit('EAS did not permit anonymous artifact access; ask the owner for the APK file. '+messages)
build=data['data']['build']['byId']
if not build or build['app']['id']!=PROJECT_ID or build['platform']!='ANDROID' or build['status']!='FINISHED':raise SystemExit('Expected a finished Android build belonging to the Smart Power project.')
artifact=build.get('artifacts') or {};url=artifact.get('applicationArchiveUrl') or artifact.get('buildUrl')
def allowed(value):
 u=urllib.parse.urlparse(value);host=(u.hostname or '').lower()
 return u.scheme=='https' and not u.username and not u.password and (host=='expo.dev' or host.endswith('.expo.dev') or host=='storage.googleapis.com' or host.endswith('.googleapis.com') or host.endswith('.cloudfront.net') or host.endswith('.amazonaws.com'))
class OfficialRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  if not allowed(newurl):raise ValueError('Artifact redirect host was not approved.')
  return super().redirect_request(req,fp,code,msg,headers,newurl)
if not url or not allowed(url):raise SystemExit('No approved official artifact URL was available.')
opener=urllib.request.build_opener(OfficialRedirect());target=OUT/'Smart-Power-original.apk';digest=hashlib.sha256();size=0
with opener.open(url,timeout=120) as response,target.open('wb') as output:
 while chunk:=response.read(1024*1024):
  size+=len(chunk)
  if size>512*1024*1024:raise SystemExit('Artifact exceeded the verification size limit.')
  digest.update(chunk);output.write(chunk)
with zipfile.ZipFile(target) as archive:
 names=archive.namelist()
 if 'AndroidManifest.xml' not in names or 'classes.dex' not in names:raise SystemExit('The artifact is not an Android APK. A Play Store AAB cannot be checked as an installable APK.')
commit=build.get('gitCommitHash')
report={'buildId':BUILD_ID,'projectId':PROJECT_ID,'version':build.get('appVersion'),'versionCode':build.get('appBuildVersion'),'commit':commit,'sha256':digest.hexdigest(),'bytes':size,'apkDownloadedFromOfficialEAS':True,'malwareScan':'not yet run','note':'A permission/certificate inspection or an antivirus result does not prove an APK is free of all malicious behaviour.'}
(OUT/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
