export async function collectPaged(fetchPage,pageSize=1000){
  if(!Number.isInteger(pageSize)||pageSize<=0)throw new Error('pageSize must be a positive integer')
  const all=[]
  for(let from=0;;from+=pageSize){
    const to=from+pageSize-1
    const result=await fetchPage(from,to)
    if(result?.error)throw result.error
    const page=Array.isArray(result?.data)?result.data:[]
    all.push(...page)
    if(page.length<pageSize)break
  }
  return all
}
