import type {AppExecution,AppTestSuite} from '../../types'
import {executionState,executionCode,clockDuration} from '../executions/executionPresentation'
import {notificationTime,localDayKey} from '../notifications/notificationPresentation'
export {executionState,executionCode,clockDuration}
export const reportTime=(record:AppExecution)=>notificationTime(record.started_at||record.created_at)
export const reportAvailable=(record:AppExecution)=>!['pending','running'].includes(executionState(record))&&(Boolean(record.report_path)||['passed','failed','error','stopped','completed'].includes(executionState(record)))
export const reportStatus=(record:AppExecution)=>({passed:{label:'通过',color:'green'},failed:{label:'失败',color:'red'},error:{label:'异常',color:'orange'},stopped:{label:'已停止',color:'gray'},running:{label:'运行中',color:'arcoblue'},pending:{label:'等待执行',color:'gray'},completed:{label:'已完成 · 未记录结果',color:'gray'},unknown:{label:'未知',color:'gray'}}[executionState(record)])
export function reportRate(record:AppExecution){if(typeof record.total_steps!=='number'||typeof record.passed_steps!=='number')return null;const total=record.total_steps,passed=record.passed_steps;return Number.isFinite(total)&&total>0&&Number.isFinite(passed)&&passed>=0&&passed<=total?passed/total*100:null}
export function rateText(rate:number|null){if(rate===null)return '—';if(rate===100)return '100%';return rate>99.9?'<100%':`${Math.round(rate*10)/10}%`}
export const reportName=(record:AppExecution)=>`${record.case_name||executionCode(record)}执行报告`
export const reportSuite=(record:AppExecution,suites:AppTestSuite[])=>suites.find(suite=>suite.id===record.test_suite_id)?.name||(record.test_suite_id?`套件 #${record.test_suite_id}`:'独立执行')
export const sourceLabel=(value:string)=>({manual:'手动执行',scheduler:'定时任务',scheduled:'定时任务',suite:'套件执行',api:'API 触发',ci:'CI 触发'}[value]||value||'未记录来源')
export const reportVersion=(record:AppExecution)=>record.package_snapshot?.version||record.app_version||'历史版本未记录'
export const reportApp=(record:AppExecution)=>record.package_snapshot?.name||record.app_name||'应用未记录'
export function reportInDates(record:AppExecution,dates?:string[]|null){if(dates?.length!==2)return true;const day=localDayKey(reportTime(record));return Boolean(day)&&day>=dates[0]&&day<=dates[1]}
export function reportOverview(records:AppExecution[],now=new Date()){
  const passed=records.filter(record=>executionState(record)==='passed').length,failed=records.filter(record=>executionState(record)==='failed').length,error=records.filter(record=>executionState(record)==='error').length
  const other=records.length-passed-failed-error,finished=records.filter(reportAvailable),durations=finished.filter(record=>Number.isFinite(record.duration)&&record.duration>=0).map(record=>record.duration)
  const days=Array.from({length:7},(_,index)=>{const date=new Date(now);date.setDate(date.getDate()-6+index);const day=localDayKey(+date),items=records.filter(record=>localDayKey(reportTime(record))===day&&['passed','failed','error'].includes(executionState(record))),count=items.filter(record=>executionState(record)==='passed').length;return {day,total:items.length,passed:count,rate:items.length?count/items.length*100:null}})
  return {total:records.length,reports:finished.length,passed,failed,error,other,average:durations.length?durations.reduce((sum,d)=>sum+d,0)/durations.length:null,days}
}
export function reportCsv(records:AppExecution[],suites:AppTestSuite[]){const cell=(value:unknown)=>{let text=String(value??'');if(/^[\s\uFEFF]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'};return '\uFEFF'+[['报告编号','报告名称','关联套件','任务编号','执行结论','步骤通过率','总步骤','通过步骤','失败步骤','耗时','执行时间（本地）','应用','历史版本','设备','错误摘要'],...records.map(record=>[executionCode(record),reportName(record),reportSuite(record,suites),record.task_id,reportStatus(record).label,rateText(reportRate(record)),record.total_steps,record.passed_steps,record.failed_steps,clockDuration(record.duration),Number.isFinite(reportTime(record))?new Date(reportTime(record)).toLocaleString('zh-CN',{hour12:false}):'—',reportApp(record),reportVersion(record),record.device_name||record.device_serial,record.error_message])].map(row=>row.map(cell).join(',')).join('\r\n')}
