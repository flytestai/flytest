import type {AppNotificationLog} from '../../types'

const channelAliases:Record<string,string>={email:'email',mail:'email',smtp:'email',feishu:'feishu',lark:'feishu',dingtalk:'dingtalk',dingding:'dingtalk',wecom:'wecom',wechat_work:'wecom',wework:'wecom',work_wechat:'wecom',webhook:'webhook',both:'both'}
export const channelLabels:Record<string,string>={email:'邮件',feishu:'飞书',dingtalk:'钉钉',wecom:'企业微信',webhook:'Webhook',both:'邮件 + Webhook',unknown:'未标明'}
const eventLabels:Record<string,string>={task_execution:'任务执行',task_triggered:'任务调度',task_schedule:'任务调度',execution_completed:'执行完成',execution_failed:'执行失败',execution_error:'执行异常',report_generated:'报告生成',system:'系统通知',execution_passed:'执行通过'}
export const notificationTime=(value?:string|null)=>{
  if(!value)return NaN
  // APP stores UTC; legacy timestamps may omit the explicit offset.
  const normalized=value.replace(' ','T')
  return Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalized)?normalized:normalized+'Z')
}
export const notificationChannel=(record:AppNotificationLog)=>{
  const raw=String(record.actual_notification_type||record.notification_type||'').toLowerCase()
  if(raw==='webhook'){
    const info=record.webhook_bot_info||{}
    for(const key of ['platform','provider','type','channel']){
      const known=channelAliases[String(info[key]||'').toLowerCase()]
      if(known&&known!=='webhook'&&known!=='email'&&known!=='both')return known
    }
  }
  return channelAliases[raw]||'unknown'
}
export const notificationEvent=(record:AppNotificationLog)=>{
  const explicit=record.response_info?.event_type
  const key=typeof explicit==='string'&&explicit?explicit:String(record.notification_type||'')
  return channelAliases[key.toLowerCase()]||!key?'unspecified':key
}
export const eventLabel=(key:string)=>eventLabels[key]||(key==='unspecified'?'通知记录':key)
export const simulatedDelivery=(record:AppNotificationLog)=>record.response_info?.delivery_status==='simulated'
export const deliveryMeta=(record:AppNotificationLog)=>simulatedDelivery(record)?{label:'模拟投递',color:'gray'}:({success:{label:'成功',color:'green'},failed:{label:'失败',color:'red'},pending:{label:'待发送',color:'orange'}}[record.status]||{label:record.status||'未知',color:'gray'})

function contentPayload(record:AppNotificationLog):Record<string,any>|null {
  try{const data=JSON.parse(record.notification_content);return data&&typeof data==='object'&&!Array.isArray(data)?data:null}catch{return null}
}
export function notificationText(record:AppNotificationLog):string {
  const payload=contentPayload(record)
  if(!payload)return record.notification_content||''
  const candidates=[payload.markdown?.content,payload.markdown?.text,payload.text?.content,payload.content?.text,payload.card?.elements?.[0]?.text?.content,typeof payload.content==='string'?payload.content:'',payload.message]
  return candidates.find(value=>typeof value==='string'&&value.trim())||record.notification_content||''
}
export function notificationTitle(record:AppNotificationLog):string {
  const payload=contentPayload(record)
  const value=record.response_info?.title||payload?.title||payload?.markdown?.title||payload?.card?.header?.title?.content
  if(typeof value==='string'&&value.trim())return value.trim()
  return `${eventLabel(notificationEvent(record))}${record.task_name?' · '+record.task_name:''}`
}
export const notificationSummary=(record:AppNotificationLog)=>notificationText(record).replace(/[#*`]/g,'').replace(/\s+/g,' ').trim()||'暂无内容'
export function localDayKey(time:number){if(!Number.isFinite(time))return '';const date=new Date(time);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
export function notificationInDates(record:AppNotificationLog,start:string,end:string){
  if(!start&&!end)return true
  const day=localDayKey(notificationTime(record.created_at));return Boolean(day)&&(!start||day>=start)&&(!end||day<=end)
}
export function notificationOverview(logs:AppNotificationLog[],now=new Date()){
  const today=localDayKey(now.getTime()),days=Array.from({length:7},(_,index)=>{const date=new Date(now);date.setDate(date.getDate()-6+index);const key=localDayKey(date.getTime());return {key,label:key.slice(5),count:0}})
  for(const log of logs){const day=days.find(item=>item.key===localDayKey(notificationTime(log.created_at)));if(day)day.count++}
  return {total:logs.length,success:logs.filter(item=>item.status==='success'&&!simulatedDelivery(item)).length,failed:logs.filter(item=>item.status==='failed'&&!simulatedDelivery(item)).length,today:logs.filter(item=>localDayKey(notificationTime(item.created_at))===today).length,simulated:logs.filter(simulatedDelivery).length,retried:logs.filter(item=>item.is_retried).length,days}
}
export function notificationCsv(logs:AppNotificationLog[]){
  const cell=(value:unknown)=>{let text=String(value??'');if(/^[\s\uFEFF]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'}
  const header=['通知编号','通知时间（本地）','通知类型','通知标题','通知内容','关联任务编号','关联任务','发送渠道','发送结果','错误信息','重试次数']
  const rows=logs.map(log=>[log.id,Number.isFinite(notificationTime(log.created_at))?new Date(notificationTime(log.created_at)).toLocaleString('zh-CN',{hour12:false}):log.created_at,eventLabel(notificationEvent(log)),notificationTitle(log),notificationText(log),log.task_id,log.task_name,channelLabels[notificationChannel(log)],deliveryMeta(log).label,log.error_message,log.retry_count])
  return '\uFEFF'+[header,...rows].map(row=>row.map(cell).join(',')).join('\r\n')
}
