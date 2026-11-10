import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DashboardData } from '../dashboard';
export function GuestHome({ onPage, onJoin }: { onPage: (path: string) => void; onJoin: () => void }) {
 return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
  <Text style={styles.eyebrow}>SMART POWER ENGINEERING WORKS</Text><Text style={styles.title}>Engineering ideas.{ '\n' }Building tomorrow.</Text><Text style={styles.description}>Explore our company and discover the team behind your next project.</Text>
  <View style={styles.hero}><Text style={styles.heroTitle}>One team. Every stage.</Text><Text style={styles.heroText}>Construction, electrical systems, renewable energy and engineering services.</Text></View>
  <Action label="Our services" hint="Explore what we do" onPress={() => onPage('/services.html')} /><Action label="Our projects" hint="Current and recently completed work" onPress={() => onPage('/our-projects.html')} /><Action label="About Smart Power" hint="Meet our company" onPress={() => onPage('/about.html')} /><Action label="Contact our team" hint="Talk to us about your project" onPress={() => onPage('/contact.html')} />
  <View style={styles.card}><Text style={styles.section}>Your own workspace</Text><Text style={styles.description}>Clients can track requests. Staff can manage their work.</Text><Pressable accessibilityRole="button" style={styles.button} onPress={onJoin}><Text style={styles.buttonText}>Sign in / Create account</Text></Pressable></View>
 </ScrollView>;
}
function Action({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
 return <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}><View style={styles.actionLabel}><Text style={styles.actionTitle}>{label}</Text><Text style={styles.actionHint}>{hint}</Text></View><Text style={styles.arrow}>›</Text></Pressable>;
}
export default function Dashboard({ data, onPage, onRetry, onSignOut }: { data: DashboardData | null; onPage: (path: string) => void; onRetry: () => void; onSignOut: () => void }) {
 const [adminTab, setAdminTab] = useState<'company' | 'people'>('company');
 const [filter, setFilter] = useState('All');const [search,setSearch] = useState('');
 if (!data) return <View style={styles.wait}><ActivityIndicator color="#0089df" /><Text style={styles.description}>Loading your dashboard…</Text><Pressable accessibilityRole="button" style={styles.button} onPress={onRetry}><Text style={styles.buttonText}>Retry</Text></Pressable></View>;
 const people=(data.people||[]).filter(person=>(filter==='All'||person.role===filter)&&(!search||(person.name+' '+person.email).toLowerCase().includes(search.toLowerCase())));
 const cards=data.role==='Admin'?[['Staff',data.summary.staff],['Clients',data.summary.clients],['Projects',data.summary.projects],['Requests',data.summary.requests]]:data.role==='Client'?[['My requests',data.summary.requests],['Open requests',data.summary.open]]:[['Pending tasks',data.summary.pending],['Latest net salary',data.summary.netSalary===null?'—':'LKR '+Number(data.summary.netSalary||0).toLocaleString()]];
 return <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
  <Text style={styles.eyebrow}>{data.role.toUpperCase()} DASHBOARD</Text><Text style={styles.title}>Hello, {data.name.split(' ')[0]}.</Text><Text style={styles.description}>{data.role==='Admin'?'Your company, people and work at a glance.':data.role==='Staff'?'Your workday, organised.':'Your projects start here.'}</Text>
  <View style={styles.metrics}>{cards.map(([label,value])=><View key={String(label)} style={styles.metric}><Text style={styles.metricValue}>{value??0}</Text><Text style={styles.metricLabel}>{label}</Text></View>)}</View>
  {data.role==='Admin'?<>
   <View style={styles.filters}>{(['company','people'] as const).map(item=><Pressable key={item} accessibilityRole="button" accessibilityState={{selected:adminTab===item}} onPress={()=>setAdminTab(item)} style={[styles.chip,adminTab===item&&styles.activeChip]}><Text style={[styles.chipText,adminTab===item&&styles.activeChipText]}>{item==='company'?'Company':'People · '+(data.people||[]).length}</Text></Pressable>)}</View>
   {adminTab==='company'?<>
   <Text style={styles.section}>Manage your company</Text>
   <Action label="Client requests" hint="Review and update enquiries" onPress={()=>onPage('/admin.html?appWorkspace=consultations')} />
   <Action label="Staff directory" hint="Staff records and assigned sites" onPress={()=>onPage('/team.html')} />
   <Action label="Tasks & work" hint="Assign tasks to your staff" onPress={()=>onPage('/admin.html?appWorkspace=tasks')} />
   <Action label="Payroll" hint="Issue salary and payslips" onPress={()=>onPage('/admin.html?appWorkspace=payroll')} />
   <Action label="Notifications" hint="Staff and client activity" onPress={()=>onPage('/admin.html?appWorkspace=notifications')} />
   <Action label="Support requests" hint="Reply to your team" onPress={()=>onPage('/admin.html?appWorkspace=support')} />
   <Action label="Manage sign-in accounts" hint="Admin and Staff access" onPress={()=>onPage('/admin.html?appWorkspace=users')} />
   <Action label="Projects" hint="Manage company projects" onPress={()=>onPage('/projects.html')} />
   <Action label="Materials" hint="Inventory and site supplies" onPress={()=>onPage('/materials.html')} />
   <Action label="Finance" hint="Invoices and payments" onPress={()=>onPage('/finance.html')} />
   <Action label="Client records" hint="Company client directory" onPress={()=>onPage('/clients.html')} />
   <Action label="Staff time logs" hint="Attendance across all sites" onPress={()=>onPage('/admin.html?appWorkspace=stafflogs')} />
   <Action label="Staff work updates" hint="Progress and site photos" onPress={()=>onPage('/admin.html?appWorkspace=workupdates')} />
   <Action label="Reports" hint="Download company reports" onPress={()=>onPage('/reports.html')} />
   <Action label="Company settings" hint="Office contact details" onPress={()=>onPage('/settings.html')} />
   <Action label="My profile" hint="Your personal details" onPress={()=>onPage('/profile.html')} />
   </>:<>
   <Text style={styles.section}>People · {(data.people||[]).length}</Text><Text style={styles.description}>Every Client, Staff and Admin account.</Text>
   <TextInput style={styles.search} accessibilityLabel="Search people" placeholder="Search name or email" value={search} onChangeText={setSearch} autoCapitalize="none" />
   <View style={styles.filters}>{['All','Client','Staff','Admin'].map(item=><Pressable key={item} accessibilityRole="button" accessibilityState={{selected:filter===item}} onPress={()=>setFilter(item)} style={[styles.chip,filter===item&&styles.activeChip]}><Text style={[styles.chipText,filter===item&&styles.activeChipText]}>{item}</Text></Pressable>)}</View>
   {people.map(person=><View key={person.key} style={styles.person}><View style={styles.avatar}><Text style={styles.avatarText}>{person.name.slice(0,1).toUpperCase()}</Text></View><View style={styles.actionLabel}><Text style={styles.actionTitle}>{person.name}</Text><Text style={styles.actionHint}>{person.email}</Text><Text style={styles.role}>{person.role} · {person.active?'Active':'Inactive'}</Text></View></View>)}{!people.length&&<Text style={styles.description}>No people match this view.</Text>}
   </>}
  </>:data.role==='Staff'?<>
   <View style={styles.hero}><Text style={styles.heroTitle}>{data.attendance&&!data.attendance.check_out?'Checked in':'Ready for your next shift?'}</Text><Text style={styles.heroText}>{data.attendance?.site||'Open Attendance to check in at your site.'}</Text></View>
   <Action label="Attendance" hint="Check in and check out" onPress={()=>onPage('/staff-attendance.html')} /><Action label="My tasks" hint="Assignments and work photos" onPress={()=>onPage('/staff-tasks.html')} /><Action label="My salary" hint="Payslips and payments" onPress={()=>onPage('/staff-salary.html')} /><Action label="My notifications" hint="Office updates for you" onPress={()=>onPage('/staff-dashboard.html?appWorkspace=notifications')} /><Action label="Office support" hint="Ask the office for assistance" onPress={()=>onPage('/staff-dashboard.html?appWorkspace=support')} /><Action label="My profile" hint="Personal and employment details" onPress={()=>onPage('/profile.html')} />
   <Text style={styles.section}>Recent tasks</Text>{(data.tasks||[]).map(task=><View style={styles.card} key={task.id}><Text style={styles.actionTitle}>{task.name}</Text><Text style={styles.description}>{task.site} · {task.status}</Text></View>)}{!data.tasks?.length&&<Text style={styles.description}>Your assigned tasks will appear here.</Text>}
  </>:<>
   <Action label="New request" hint="Tell our team about your project" onPress={()=>onPage('/api/mobile/client/request')} />
   <Text style={styles.section}>My updates</Text>{(data.updates||[]).map((update,index)=><View style={styles.card} key={index}><Text style={styles.actionTitle}>{update.name}</Text><Text style={styles.description}>{update.details}</Text></View>)}{!data.updates?.length&&<Text style={styles.description}>Updates from our office will appear here.</Text>}
   <Text style={styles.section}>My requests</Text>{(data.requests||[]).map(request=><View style={styles.card} key={request.id}><Text style={styles.actionTitle}>{request.type}</Text><Text style={styles.role}>{request.status}</Text><Text style={styles.description}>{request.message}</Text></View>)}{!data.requests?.length&&<Text style={styles.description}>No requests yet. Start a conversation with our team.</Text>}
  </>}
  <Pressable accessibilityRole="button" style={styles.signout} onPress={onSignOut}><Text style={styles.signoutText}>Sign out</Text></Pressable>
 </ScrollView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:'#f1f7fc'},content:{padding:22,paddingBottom:36,maxWidth:800,width:'100%',alignSelf:'center'},eyebrow:{fontSize:10,fontWeight:'800',color:'#007fca',letterSpacing:1.3,marginBottom:10},title:{fontSize:32,lineHeight:38,fontWeight:'800',color:'#0c2d44'},description:{fontSize:14,color:'#607b90',lineHeight:22,marginTop:10,marginBottom:12},hero:{borderRadius:20,backgroundColor:'#0d3857',padding:24,marginTop:14,marginBottom:18},heroTitle:{fontSize:23,color:'#fff',fontWeight:'800'},heroText:{fontSize:14,lineHeight:23,color:'#b3d6ed',marginTop:10},section:{fontSize:21,fontWeight:'800',color:'#123650',marginTop:24,marginBottom:12},metrics:{flexDirection:'row',flexWrap:'wrap',gap:12,marginTop:20},metric:{flexGrow:1,flexBasis:'44%',padding:18,backgroundColor:'#fff',borderRadius:17,borderWidth:1,borderColor:'#dae8f2'},metricValue:{fontSize:25,fontWeight:'800',color:'#087dbb'},metricLabel:{color:'#607b90',fontSize:12,marginTop:6},action:{flexDirection:'row',gap:12,alignItems:'center',padding:18,borderRadius:16,backgroundColor:'#fff',marginBottom:10,borderWidth:1,borderColor:'#dfebf3'},actionLabel:{flex:1},actionTitle:{fontSize:15,fontWeight:'700',color:'#153a54'},actionHint:{fontSize:12,color:'#6c879a',marginTop:5},arrow:{fontSize:26,color:'#0089df'},card:{backgroundColor:'#fff',padding:18,borderRadius:17,marginTop:10,borderWidth:1,borderColor:'#dfebf3'},button:{backgroundColor:'#0089df',padding:15,borderRadius:13,alignItems:'center',marginTop:10},buttonText:{color:'#fff',fontWeight:'800'},search:{padding:14,borderRadius:12,borderWidth:1,borderColor:'#b9d3e6',backgroundColor:'#fff',fontSize:15},filters:{flexDirection:'row',gap:8,marginVertical:14},chip:{padding:10,paddingHorizontal:14,borderRadius:12,backgroundColor:'#dfedf7'},activeChip:{backgroundColor:'#0089df'},chipText:{color:'#4e728c',fontSize:12,fontWeight:'700'},activeChipText:{color:'#fff'},person:{flexDirection:'row',gap:13,backgroundColor:'#fff',padding:15,marginBottom:9,borderRadius:15},avatar:{width:40,height:40,borderRadius:12,backgroundColor:'#e1f2ff',alignItems:'center',justifyContent:'center'},avatarText:{fontWeight:'800',color:'#0079bc',fontSize:19},role:{fontSize:12,color:'#0079bc',fontWeight:'700',marginTop:8},signout:{padding:16,alignItems:'center',marginTop:28,borderWidth:1,borderColor:'#b9d3e6',borderRadius:13},signoutText:{fontWeight:'800',color:'#19435e'},wait:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#f1f7fc',padding:25},
});
