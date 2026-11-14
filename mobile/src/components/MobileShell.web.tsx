import { type ReactNode, type ElementRef, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import Welcome from './Welcome';
import Dashboard, { GuestHome } from './Dashboard';
import { dashboardPage } from '../dashboard';
import { siteOrigin, tabForUrl, tabUrl, type Tab } from '../navigation';
import type { DesktopCommand, DesktopState } from '../desktop';
const ORIGIN=siteOrigin(process.env.EXPO_PUBLIC_SITE_URL);
const initial:DesktopState={url:ORIGIN+'/api/mobile/entry',loading:true,error:null,canGoBack:false,role:null,id:null,dashboard:null};
const tabs:{id:Tab;label:string}[]=[{id:'home',label:'Home'},{id:'services',label:'Services'},{id:'projects',label:'Projects'},{id:'contact',label:'Contact'},{id:'workspace',label:'Workspace'}];
export default function DesktopShell({children}:{children:ReactNode}) {
 const router=useRouter(),pathname=usePathname();const dimensions=useWindowDimensions();
 const [state,setState]=useState(initial),[gate,setGate]=useState(true),[guest,setGuest]=useState(false);
 const current=useRef(initial),guestRef=useRef(false),previousRole=useRef<DesktopState['role']>(null),area=useRef<ElementRef<typeof View>>(null);
 const [rect,setRect]=useState<{x:number;y:number;width:number;height:number}|null>(null);
 const bridge=typeof window!=='undefined'?window.smartPowerDesktop:undefined;
 const command=useCallback((value:DesktopCommand)=>{void window.smartPowerDesktop?.command(value).catch(()=>{});},[]);
 useEffect(()=>{
  const desktop=window.smartPowerDesktop;if(!desktop)return;
  const accept=(value:DesktopState)=>{
   current.current=value;setState(value);
   if(!guestRef.current&&previousRole.current&&!value.role){setGate(true);setGuest(false);guestRef.current=false;}
   previousRole.current=value.role;
  };
  const dispose=desktop.onState(accept);void desktop.getState().then(accept);return dispose;
 },[]);
 const navigate=useCallback((tab:Tab)=>{
  if(!current.current.role&&!guestRef.current||tab==='workspace'&&guestRef.current){setGate(true);return;}
  const url=tabUrl(tab,ORIGIN,guestRef.current?null:current.current.role);
  command({type:'navigate',path:url.slice(ORIGIN.length)});
 },[command]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>{const tab=pathname.slice(1) as Tab;if(tabs.some(item=>item.id===tab))navigate(tab)});return()=>cancelAnimationFrame(frame)},[pathname,navigate]);
 const isDashboard=dashboardPage(state.url,ORIGIN),path=new URL(state.url).pathname;
 const guestHome=guest&&['/','/index.html'].includes(path);
 const guestBlocked=guest&&tabForUrl(state.url)==='workspace';
 const showGate=gate||guestBlocked;
 const showRemote=!showGate&&!isDashboard&&!guestHome&&!state.loading&&!state.error;
 useEffect(()=>{const frame=requestAnimationFrame(()=>area.current?.measureInWindow((x,y,width,height)=>setRect({x,y,width,height})));return()=>cancelAnimationFrame(frame)},[dimensions.width,dimensions.height]);
 useEffect(()=>{if(bridge)void bridge.surface(showRemote?rect:null);return()=>{if(bridge)void bridge.surface(null)}},[bridge,rect,showRemote]);
 function auth(action:'login'|'register',role:'Client'|'Staff'|'Admin'){guestRef.current=false;setGuest(false);setGate(false);command({type:'auth',action,role})}
 function browse(){guestRef.current=true;setGuest(true);setGate(false);command({type:'guest'})}
 function page(value:string){command({type:'navigate',path:value})}
 const selected=tabForUrl(state.url);
 return <View style={styles.root}>
  <View style={styles.header}><Image source={require('../../assets/icon.png')} style={styles.logo}/><View style={styles.brand}><Text style={styles.title}>SMART POWER</Text><Text style={styles.subtitle}>ENGINEERING WORKS · WINDOWS</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={()=>{if(!state.role&&!guest)setGate(true);else command({type:'back'})}} style={styles.tool}><Text style={styles.toolText}>← Back</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>command({type:'reload'})} style={styles.tool}><Text style={styles.toolText}>Refresh</Text></Pressable></View>
  {!showGate&&<View style={styles.tabs}>{tabs.map(tab=><Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{selected:selected===tab.id}} style={[styles.tab,selected===tab.id&&styles.selected]} onPress={()=>{if(pathname==='/'+tab.id)navigate(tab.id);else router.replace('/'+tab.id)}}><Text style={[styles.tabText,selected===tab.id&&styles.selectedText]}>{tab.id==='home'&&state.role&&!guest?'Dashboard':tab.label}</Text></Pressable>)}</View>}
  <View ref={area} style={styles.content} onLayout={()=>area.current?.measureInWindow((x,y,width,height)=>setRect({x,y,width,height}))}>
   {!bridge?<View style={styles.wait}><Text style={styles.heading}>Smart Power for Windows</Text><Text style={styles.muted}>Open the installed desktop app to connect to your workspace.</Text></View>:showGate?<Welcome onSignIn={role=>auth('login',role)} onCreate={role=>auth('register',role)} onGuest={browse}/>:state.error?<View style={styles.wait}><Text style={styles.heading}>Unable to connect</Text><Text style={styles.muted}>Check your internet connection, then try again.</Text><Pressable style={styles.button} onPress={()=>command({type:'reload'})}><Text style={styles.buttonText}>Try again</Text></Pressable></View>:isDashboard?<Dashboard data={guest?null:state.dashboard} onPage={page} onRetry={()=>command({type:'reload'})} onSignOut={()=>command({type:'logout'})}/>:guestHome?<GuestHome onPage={page} onJoin={()=>setGate(true)}/>:state.loading?<View style={styles.wait}><ActivityIndicator color="#0089df"/><Text style={styles.muted}>Loading your workspace…</Text></View>:null}
  </View>
  <View style={styles.footer}><Text style={styles.muted}>Powered by Smart </Text><Pressable accessibilityRole="button" accessibilityLabel="Admin sign in" onPress={()=>auth('login','Admin')}><Text style={styles.power}>Power</Text></Pressable></View>
  {children}
 </View>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:'#f1f7fc',height:'100%'},header:{height:76,paddingHorizontal:24,flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#061d35'},logo:{width:46,height:46,borderRadius:13},brand:{flex:1},title:{color:'#fff',fontWeight:'800',fontSize:19,letterSpacing:1},subtitle:{color:'#91c6e9',fontSize:10,marginTop:5,letterSpacing:1.4},tool:{padding:12,borderRadius:11,backgroundColor:'#14334f'},toolText:{color:'#dceffd',fontWeight:'700'},tabs:{flexDirection:'row',gap:8,padding:12,paddingHorizontal:24,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#d7e6f0'},tab:{paddingVertical:12,paddingHorizontal:24,borderRadius:11},selected:{backgroundColor:'#e1f2ff'},tabText:{color:'#58758c',fontWeight:'700'},selectedText:{color:'#0078c5'},content:{flex:1,minHeight:0},footer:{height:40,flexDirection:'row',alignItems:'center',justifyContent:'center',borderTopWidth:1,borderTopColor:'#d7e6f0'},muted:{color:'#6b859a',fontSize:13,marginVertical:10},power:{color:'#0079bc',fontWeight:'800',fontSize:13},wait:{flex:1,alignItems:'center',justifyContent:'center',padding:28},heading:{fontSize:24,fontWeight:'800',color:'#143650'},button:{backgroundColor:'#0089df',padding:16,borderRadius:12,marginTop:16},buttonText:{color:'#fff',fontWeight:'800'}});
