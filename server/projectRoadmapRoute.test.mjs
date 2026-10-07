import { once } from 'node:events'
import { expect, it, vi } from 'vitest'
import { createProductionServer } from './index.mjs'
it('stellt Roadmap über die bestehende API-Middleware im Mock-Modus bereit',async()=>{
 const server=createProductionServer({env:{AI_PROVIDER:'mock',NODE_ENV:'development'}})
 const log=vi.spyOn(console,'warn').mockImplementation(()=>{})
 server.listen(0,'127.0.0.1');await once(server,'listening')
 const url='http://127.0.0.1:'+server.address().port+'/api/project-roadmap'
 const input={title:'Java lernen',goal:'Java Grundlagen',startingLevel:{type:'basic'},duration:{type:'open-ended'},weeklyMinutes:300,daysPerWeek:2,learningContext:{}}
 try {
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)})
  expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');const body=await response.json();expect(body.source).toBe('mock');expect(body.roadmap.version).toBe(1)
  expect((await fetch(url)).status).toBe(405)
  expect((await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...input,weeklyMinutes:0})})).status).toBe(400)
  expect((await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(17000)})).status).toBe(413)
 } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));log.mockRestore()}
})
