export const allocationsOf=payment=>Array.isArray(payment?.payment_allocations)?payment.payment_allocations:[]

export const hasDealAllocation=payment=>allocationsOf(payment).length>0

export const standaloneOutstandingTotal=payments=>(payments||[])
  .filter(p=>p?.status==='outstanding'&&p?.type!=='refund'&&!hasDealAllocation(p))
  .reduce((sum,p)=>sum+Number(p?.amount||0),0)

export const dealOutstandingTotal=deals=>(deals||[])
  .filter(d=>d?.status!=='cancelled')
  .reduce((sum,d)=>sum+Number(d?.balance_amount||0),0)

export const accountOutstanding=(deals=[],payments=[])=>dealOutstandingTotal(deals)+standaloneOutstandingTotal(payments)

export const dealPaidAmount=deal=>{
  if(deal?.paid_amount!=null)return Number(deal.paid_amount||0)
  return Math.max(0,Number(deal?.final_price||0)-Number(deal?.balance_amount||0))
}

export const dealRefundedAmount=deal=>Number(deal?.refunded_amount||0)
