import test from 'node:test'
import assert from 'node:assert/strict'
import { collectPaged } from '../src/lib/paging.js'
import { nextCalendarCursor } from '../src/lib/calendar.js'
import { customerLabel, leadLabel, personLabel } from '../src/lib/utils.js'
import { canDirectInstallHairSystem, canMoveAppointment } from '../src/lib/guards.js'
import { accountOutstanding } from '../src/lib/finance.js'

test('backup pagination exports more than one database page',async()=>{
  const source=Array.from({length:1203},(_,i)=>({id:i+1}))
  const rows=await collectPaged(async(from,to)=>({data:source.slice(from,to+1),error:null}),1000)
  assert.equal(rows.length,1203)
  assert.deepEqual(rows.at(-1),{id:1203})
})

test('backup pagination aborts when any page fails',async()=>{
  let calls=0
  await assert.rejects(
    collectPaged(async()=>{calls++;return calls===2?{data:null,error:new Error('page failed')}:{data:Array.from({length:2},(_,i)=>({id:i})),error:null}},2),
    /page failed/
  )
})

test('person labels tolerate missing joined records',()=>{
  assert.equal(customerLabel(null),'Customer')
  assert.equal(leadLabel(null),'Unnamed lead')
  assert.equal(personLabel({customers:null,leads:null}),'Unassigned person')
})

test('month navigation from the 31st lands in the immediate next month',()=>{
  const next=nextCalendarCursor(new Date(2026,0,31,12,0,0),'month',1)
  assert.equal(next.getFullYear(),2026)
  assert.equal(next.getMonth(),1)
  assert.equal(next.getDate(),1)
})

test('started or completed appointments cannot be moved',()=>{
  assert.equal(canMoveAppointment('confirmed'),true)
  assert.equal(canMoveAppointment('in_progress'),false)
  assert.equal(canMoveAppointment('completed'),false)
})

test('only available hair systems can be directly installed',()=>{
  assert.equal(canDirectInstallHairSystem('available'),true)
  for(const status of ['reserved','installed','damaged','returned'])assert.equal(canDirectInstallHairSystem(status),false)
})


test('account outstanding does not double count deal-linked outstanding payments',()=>{
  const deals=[{status:'installation_booked',balance_amount:80}]
  const payments=[
    {status:'outstanding',type:'balance',amount:80,payment_allocations:[{deal_id:'deal-1',amount:80}]},
    {status:'outstanding',type:'sale',amount:25,payment_allocations:[]}
  ]
  assert.equal(accountOutstanding(deals,payments),105)
})
