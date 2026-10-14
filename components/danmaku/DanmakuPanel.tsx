import React,{useEffect,useRef,useState} from 'react';
import {Modal,View,Text,TextInput,ScrollView,StyleSheet,TVFocusGuideView} from 'react-native';
import {StyledButton} from '@/components/StyledButton';
import {useDanmakuStore} from '@/stores/danmakuStore';
import {DanmakuError} from '@/services/danmaku/api';
import {DanmakuAnime,DanmakuMatch,DanmakuSettings,DEFAULT_DANMAKU_SETTINGS} from '@/services/danmaku/types';
import {mediaKey,sourceKey,seasonOf} from '@/services/danmaku/matching';
import {DanmakuConnection} from './DanmakuConnection';

function PanelInput(props:React.ComponentProps<typeof TextInput>){
 const [focused,setFocused]=useState(false);
 return <TextInput {...props} onFocus={event=>{setFocused(true);props.onFocus?.(event);}} onBlur={event=>{setFocused(false);props.onBlur?.(event);}} style={[props.style,focused&&{borderColor:'#2edc8c',backgroundColor:'#16342b'}]}/>;
}
const cycle=(values:number[],value:number)=>values[(values.indexOf(value)+1)%values.length];
export function DanmakuPanel({context='player'}:{context?:'player'|'global'}){
 const d=useDanmakuStore();const s=d.settings;const visible=d.panelOpen&&d.panelContext===context;
 const [tab,setTab]=useState<'settings'|'search'|'episodes'|'confirm'>('settings');
 const [keyword,setKeyword]=useState('');const [season,setSeason]=useState('');const [filter,setFilter]=useState('');
 const [results,setResults]=useState<DanmakuAnime[]>([]);const [anime,setAnime]=useState<DanmakuAnime|null>(null);
 const [episodes,setEpisodes]=useState<DanmakuMatch[]>([]);const [choice,setChoice]=useState<DanmakuMatch|null>(null);
 const [page,setPage]=useState(0);
 const mediaIdentity=d.media?mediaKey(d.media)+sourceKey(d.media):'';
 const [provider,setProvider]=useState('全部');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 const [color,setColor]=useState(s.color);const request=useRef<AbortController|null>(null);
 const sequence=useRef(0);const mounted=useRef(true);
 const cancel=()=>{request.current?.abort();request.current=null;sequence.current++;};
 const close=()=>{cancel();d.setPanelOpen(false,context);};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current?.abort();};},[]);
 useEffect(()=>{
  request.current?.abort();sequence.current++;
  if(visible){setPage(0);setTab('settings');setKeyword(d.media?.title||'');setSeason(d.media?.season?String(d.media.season):'');setNotice('');setColor(s.color);setBusy(false);}
  else {request.current?.abort();sequence.current++;}
  // Opening a panel initializes its draft, not each native clock update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[visible,mediaIdentity]);
 const report=(error:unknown)=>setNotice(error instanceof DanmakuError?error.message:'操作未完成，请重试');
 const run=async(action:()=>Promise<unknown>)=>{setNotice('');setBusy(true);try{await action();}catch(e){if(mounted.current)report(e);}finally{if(mounted.current)setBusy(false);}};
 const patch=(value:Partial<DanmakuSettings>)=>void run(()=>d.setSettings(value));
 const toggle=(key:'autoLoad'|'enabled'|'scroll'|'top'|'bottom'|'deduplicate'|'useOriginalColor')=>patch({[key]:!s[key]});
 const search=async()=>{
  cancel();const own=sequence.current;const controller=new AbortController();request.current=controller;setBusy(true);setNotice('');setResults([]);setPage(0);setProvider('全部');
  let title=keyword.trim();const n=Number(season);
  if(!title){setNotice('请输入影视名称');setBusy(false);return;}
  if(season&&(!Number.isInteger(n)||n<1||n>99)){setNotice('季数请输入 1–99，电影可留空');setBusy(false);return;}
  if(season&&seasonOf(title)!==n){title=title.replace(/第\s*[一二三四五六七八九十两\d]+\s*季|\bseason\s*\d+\b|\bS\d{1,2}\b/gi,'').trim()+` 第${n}季`;}
  try{const list=await d.search(title,controller.signal);if(own!==sequence.current)return;setResults(list);setNotice(list.length?'请选择作品及来源':'没有搜索结果，可更换名称或清空季数');}
  catch(e){if(own===sequence.current)report(e);}finally{if(own===sequence.current)setBusy(false);}
 };
 const selectAnime=async(value:DanmakuAnime)=>{
  cancel();const own=sequence.current;const controller=new AbortController();request.current=controller;setBusy(true);setNotice('');setAnime(value);setEpisodes([]);setFilter('');setPage(0);setTab('episodes');
  try{const list=await d.episodes(value,controller.signal);if(own!==sequence.current)return;setEpisodes(list);if(!list.length)setNotice('该来源未返回剧集');}
  catch(e){if(own===sequence.current)report(e);}finally{if(own===sequence.current)setBusy(false);}
 };
 const reset=()=>void run(async()=>{const {apiUrl,token}=d.settings;await d.setSettings({...DEFAULT_DANMAKU_SETTINGS,apiUrl,token});if(context==='player')await d.setMediaOffset(0);setColor(DEFAULT_DANMAKU_SETTINGS.color);setNotice('显示参数已恢复，保留连接和手动选择');});
 const row=(label:string,value:string,id:string,action:()=>void)=><View style={styles.row} key={id}><Text style={styles.label}>{label}</Text><StyledButton text={value} accessibilityLabel={id} onPress={action} disabled={busy||d.settingsSaving} style={styles.value}/></View>;
 const providers=['全部',...new Set(results.map(a=>a.source||a.animeTitle.match(/from\s+(.+)$/i)?.[1]||'其他'))];
 const filtered=results.filter(a=>provider==='全部'||(a.source||a.animeTitle.match(/from\s+(.+)$/i)?.[1]||'其他')===provider);
 return <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
  <View style={styles.backdrop}><TVFocusGuideView autoFocus trapFocusLeft trapFocusRight trapFocusUp trapFocusDown style={styles.panel}>
   <View style={styles.header}><Text style={styles.title}>{context==='global'?'全局弹幕设置':'播放弹幕设置'}</Text><StyledButton text="返回播放 / 关闭" accessibilityLabel="danmaku-close" hasTVPreferredFocus onPress={close}/></View>
   <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
    <Text style={styles.status}>{busy||d.settingsSaving?'处理中…':notice||d.message}</Text>
    {context==='player'&&<Text style={styles.hint}>{d.media?.title} {d.media?.year} {d.media?.movie?'电影':`第${d.media?.season||'?'}季 · ${d.media?.episodeTitle||'集数未知'}`} {'\n'}{d.match?`当前：${d.match.animeTitle} / ${d.match.episodeTitle}（${d.comments.length} 条）`:'尚未选择弹幕'}</Text>}
    {tab==='settings'?<>
     {context==='global'&&<DanmakuConnection/>}
     {context==='player'&&<View style={styles.actions}>
      <StyledButton text="重新自动匹配" accessibilityLabel="danmaku-rematch" disabled={busy} onPress={()=>void run(()=>d.rematch())}/>
      <StyledButton text="手动搜索 / 切换来源" accessibilityLabel="danmaku-manual" onPress={()=>{cancel();setTab('search');setResults([]);setNotice('');}}/>
     </View>}
     {row('自动加载',s.autoLoad?'开':'关','danmaku-auto',()=>toggle('autoLoad'))}
     {row('弹幕显示',s.enabled?'开':'关','danmaku-enabled',()=>toggle('enabled'))}
     {row('每视频秒上限',s.perSecond?`${s.perSecond} 条`:'不限（仍受同屏上限约束）','danmaku-limit',()=>patch({perSecond:cycle([1,2,4,0],s.perSecond)}))}
     {row('同屏上限',`${s.maxOnScreen} 条`,'danmaku-cap',()=>patch({maxOnScreen:cycle([2,4,6,8,12,16,24],s.maxOnScreen)}))}
     {row('字号',String(s.fontSize),'danmaku-font',()=>patch({fontSize:cycle([20,24,26,30,34,38,40],s.fontSize)}))}
     {row('不透明度',`${Math.round(s.opacity*100)}%`,'danmaku-opacity',()=>patch({opacity:cycle([0.25,0.5,0.75,1],s.opacity)}))}
     {row('滚动用时（越短越快）',`${s.travelSeconds} 视频秒`,'danmaku-speed',()=>patch({travelSeconds:cycle([4,6,8,10,12,16],s.travelSeconds)}))}
     {row('显示区域',`上方 ${Math.round(s.area*100)}%`,'danmaku-area',()=>patch({area:cycle([0.25,0.5,0.75,1],s.area)}))}
     {row('滚动弹幕',s.scroll?'开':'关','danmaku-scroll',()=>toggle('scroll'))}
     {row('固定顶部',s.top?'开':'关','danmaku-top',()=>toggle('top'))}
     {row('固定底部（区域内）',s.bottom?'开':'关','danmaku-bottom',()=>toggle('bottom'))}
     {row('重复过滤',s.deduplicate?'开（10 视频秒）':'关','danmaku-dedup',()=>toggle('deduplicate'))}
     {row('使用来源颜色',s.useOriginalColor?'开':'关（使用自选颜色）','danmaku-original-color',()=>toggle('useOriginalColor'))}
     <Text style={styles.label}>自选颜色 #RRGGBB</Text><View style={styles.actions}>
      <PanelInput value={color} onChangeText={setColor} accessibilityLabel="danmaku-color-input" style={styles.input} autoCapitalize="none" autoCorrect={false}/>
      <StyledButton text="应用颜色" accessibilityLabel="danmaku-color-save" onPress={()=>/^#[0-9a-f]{6}$/i.test(color)?patch({color,useOriginalColor:false}):setNotice('请输入 #RRGGBB，例如 #FFFFFF')}/>
     </View>
     <Text style={styles.label}>{context==='player'?`当前集 / 当前播放源偏移：${d.mediaOffset.toFixed(1)} 秒`:`全局时间偏移：${s.offset.toFixed(1)} 秒`}</Text>
     <Text style={styles.hint}>正值延后弹幕，负值提前。播放器内的偏移只保存到当前影视、当前集和当前播放源。</Text>
     <View style={styles.actions}>
      <StyledButton text="提前 1 秒" accessibilityLabel="danmaku-offset-minus" onPress={()=>context==='player'?void run(()=>d.setMediaOffset(d.mediaOffset-1)):patch({offset:s.offset-1})}/>
      <StyledButton text="延后 1 秒" accessibilityLabel="danmaku-offset-plus" onPress={()=>context==='player'?void run(()=>d.setMediaOffset(d.mediaOffset+1)):patch({offset:s.offset+1})}/>
      <StyledButton text="偏移归零" accessibilityLabel="danmaku-offset-zero" onPress={()=>context==='player'?void run(()=>d.setMediaOffset(0)):patch({offset:0})}/>
     </View>
     <StyledButton text="恢复默认显示参数" accessibilityLabel="danmaku-reset" disabled={busy} onPress={reset}/>
    </>:<>
     <StyledButton text={tab==='episodes'?'返回搜索':tab==='confirm'?'返回剧集':'返回设置'} accessibilityLabel="danmaku-step-back" onPress={()=>{cancel();setBusy(false);setPage(0);setTab(tab==='episodes'?'search':tab==='confirm'?'episodes':'settings');}}/>
     {tab==='search'&&<>
      <Text style={styles.label}>影视名称</Text><PanelInput value={keyword} onChangeText={setKeyword} style={styles.input} accessibilityLabel="danmaku-search-input" autoCorrect={false}/>
      <Text style={styles.label}>真实季数（电影留空）</Text><PanelInput value={season} onChangeText={setSeason} style={styles.input} accessibilityLabel="danmaku-season-input" keyboardType="number-pad"/>
      <StyledButton text={busy?'正在搜索…':'搜索'} accessibilityLabel="danmaku-search-go" onPress={()=>void search()} disabled={busy}/>
      {row('筛选来源',provider,'danmaku-provider',()=>{setProvider(providers[(providers.indexOf(provider)+1)%providers.length]);setPage(0);})}
      {filtered.slice(page*10,(page+1)*10).map((a,i)=><StyledButton key={a.animeId} text={`${a.animeTitle} · ${a.source||'来源见标题'}${seasonOf(a.animeTitle)?` · 第${seasonOf(a.animeTitle)}季`:''}`} accessibilityLabel={`danmaku-anime-${i}`} onPress={()=>void selectAnime(a)} style={styles.result}/>)}
     </>}
     {tab==='search'&&filtered.length>10&&<View style={styles.actions}><StyledButton text="上一页来源" disabled={page===0} onPress={()=>setPage(page-1)}/><StyledButton text="下一页来源" disabled={(page+1)*10>=filtered.length} onPress={()=>setPage(page+1)}/></View>}
     {tab==='episodes'&&<>
      <Text style={styles.label}>{anime?.animeTitle}</Text><Text style={styles.hint}>保留来源原始集名，请核对特别篇、合并集和偏移集数。</Text>
      <PanelInput value={filter} onChangeText={value=>{setFilter(value);setPage(0);}} style={styles.input} accessibilityLabel="danmaku-episode-filter" placeholder="按集名或集数筛选" placeholderTextColor="#999"/>
      {episodes.filter(e=>!filter||e.episodeTitle.includes(filter)).slice(page*30,(page+1)*30).map((e,i)=><StyledButton key={e.episodeId} text={e.episodeTitle} accessibilityLabel={`danmaku-episode-${i}`} style={styles.result} onPress={()=>{setChoice(e);setTab('confirm');}}/>)}
     </>}
     {tab==='episodes'&&<View style={styles.actions}><StyledButton text="上一页" disabled={page===0} onPress={()=>setPage(page-1)}/><Text style={styles.label}>第 {page+1} 页</Text><StyledButton text="下一页" disabled={(page+1)*30>=episodes.filter(e=>!filter||e.episodeTitle.includes(filter)).length} onPress={()=>setPage(page+1)}/></View>}
     {tab==='confirm'&&choice&&<>
      <Text style={styles.label}>确认加载此弹幕来源</Text><Text style={styles.hint}>{choice.animeTitle}{'\n'}{choice.episodeTitle}{'\n'}此选择会保存到当前影视 / 季 / 集，播放视频不会被替换。</Text>
      <StyledButton text="确认加载" accessibilityLabel="danmaku-confirm" disabled={busy} onPress={()=>void run(async()=>{await d.selectMatch(choice);if(useDanmakuStore.getState().match?.episodeId===choice.episodeId)setTab('settings');})}/>
     </>}
    </>}
   </ScrollView>
  </TVFocusGuideView></View>
 </Modal>;
}
const styles=StyleSheet.create({backdrop:{flex:1,backgroundColor:'#0008',alignItems:'center',justifyContent:'center'},panel:{width:'92%',height:'94%',backgroundColor:'#15191f',borderRadius:12,borderColor:'#57616d',borderWidth:1},header:{padding:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderColor:'#444'},title:{fontSize:24,color:'#fff',fontWeight:'bold'},body:{padding:18,gap:14},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},label:{fontSize:20,color:'#fff',flexShrink:1},value:{minWidth:190},status:{fontSize:18,color:'#70e1a0'},hint:{fontSize:17,color:'#bdc7d1',lineHeight:25},actions:{flexDirection:'row',flexWrap:'wrap',gap:10,alignItems:'center'},input:{fontSize:20,color:'#fff',borderColor:'#81909f',borderWidth:2,borderRadius:6,padding:10,minWidth:200},result:{marginVertical:5}});
