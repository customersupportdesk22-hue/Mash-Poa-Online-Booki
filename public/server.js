const express = require("express");
const helmet = require("helmet");
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const { Server } = require("socket.io");
const { MongoClient } = require("mongodb");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false }, maxHttpBufferSize: 1e6 });
const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.AGENT_PASSWORD || process.env.ADMIN_PASSWORD;
const DB_NAME = process.env.MONGODB_DB || "mashpoa";

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"], maxAge: "7d", setHeaders: (res, p) => { if (/\.(html|js|css)$/.test(p)) res.setHeader("Cache-Control", "no-cache"); } }));
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Mash Poa Online Booking", database: db ? "connected" : "memory-or-not-configured" }));

let db = null;
let mongoClient = null;
const memory = { settings: [], routes: [], schedules: [], bookings: [], chats: [] };
let aiConfig = { enabled: false, model: "gemini-2.5-flash", notes: "" };
const col = (name) => db ? db.collection(name) : null;
const _cache = {};
async function _all(name, sort = {}) { const c=col(name); return c ? c.find({}).sort(sort).toArray() : memory[name]; }
async function all(name, sort = {}) {
  if ((name === "routes" || name === "schedules") && !Object.keys(sort).length) {
    const h = _cache[name]; if (h && Date.now() - h.t < 15000) return h.v;
    const v = await _all(name, sort); _cache[name] = { t: Date.now(), v }; return v;
  }
  return _all(name, sort);
}
async function one(name, query) { const c=col(name); return c ? c.findOne(query) : memory[name].find(x=>Object.entries(query).every(([k,v])=>x[k]===v)) || null; }
async function save(name, doc) {
  delete _cache[name];
  const c=col(name);
  if(c) { const {_id,...data}=doc; await c.updateOne({_id},{$set:data},{upsert:true}); return doc; }
  const i=memory[name].findIndex(x=>x._id===doc._id); if(i<0) memory[name].push(doc); else memory[name][i]=doc; return doc;
}
async function remove(name,id) { delete _cache[name]; const c=col(name); if(c) return c.deleteOne({_id:id}); memory[name]=memory[name].filter(x=>x._id!==id); }
function admin(req,res,next) { if(!ADMIN_PASSWORD) return res.status(503).json({error:"Admin password is not configured. Set AGENT_PASSWORD in the hosting environment."}); if(req.get("x-admin-password")!==ADMIN_PASSWORD) return res.status(401).json({error:"Wrong password"}); next(); }
const clip=(v,n=300)=>String(v??"").trim().slice(0,n);
const id=()=>crypto.randomBytes(12).toString("hex");
const safePayment=s=>({type:s?.type||"paybill",number:s?.number||"",account:s?.account||"",accountName:s?.accountName||"Mash Poa",paymentMode:s?.paymentMode||"admin",override:Number(s?.override)||0});
app.get("/api/booking-config", async (req,res)=>{const routes=await all("routes");res.json({configured:routes.length>0, routes, schedules:req.query.light?[]:await all("schedules")});});
app.get("/api/payment-settings", async (_req,res)=>res.json(safePayment(await one("settings",{_id:"global"}))));
app.post("/api/admin/login",(req,res)=>{if(!ADMIN_PASSWORD)return res.status(503).json({ok:false,error:"Set AGENT_PASSWORD in hosting environment."});res.json({ok:req.get("x-admin-password")===ADMIN_PASSWORD});});
app.get("/api/admin/settings",admin,async(_req,res)=>res.json(safePayment(await one("settings",{_id:"global"}))));
app.put("/api/admin/settings",admin,async(req,res)=>{
 const p=req.body||{}; const type=["paybill","till","phone","bank"].includes(p.type)?p.type:"paybill";
 const paymentMode=["admin","automatic","stk"].includes(p.paymentMode)?p.paymentMode:"admin";
 const doc={_id:"global",type,number:clip(p.number,40),account:clip(p.account,60),accountName:clip(p.accountName,80)||"Mash Poa",paymentMode,override:Math.max(0,Number(p.override)||0),updatedAt:Date.now()};
 await save("settings",doc); res.json({ok:true,settings:safePayment(doc)});
});
app.get("/api/admin/ai-settings",admin,async(_req,res)=>{const d=await one("settings",{_id:"ai"})||aiConfig;res.json({enabled:!!d.enabled,model:d.model||aiConfig.model,notes:d.notes||"",hasKey:!!process.env.GEMINI_API_KEY});});
app.put("/api/admin/ai-settings",admin,async(req,res)=>{const p=req.body||{};aiConfig={enabled:!!p.enabled,model:clip(p.model,80)||"gemini-2.5-flash",notes:clip(p.notes,3000)};await save("settings",{_id:"ai",...aiConfig});res.json({ok:true,hasKey:!!process.env.GEMINI_API_KEY});});
app.get("/api/admin/routes",admin,async(_req,res)=>res.json(await all("routes")));
app.post("/api/admin/routes",admin,async(req,res)=>{
 const p=req.body||{}; const origin=clip(p.origin,80),destination=clip(p.destination,80),fare=Number(p.fare);
 if(!origin||!destination||origin.toLowerCase()===destination.toLowerCase()||!Number.isFinite(fare)||fare<=0) return res.status(400).json({error:"Enter a valid origin, destination and positive fare."});
 const doc={_id:p.id||id(),origin,destination,stops:Array.isArray(p.stops)?p.stops.map(x=>clip(x,80)).filter(Boolean):[],fare_kes:Math.round(fare),active:p.active!==false};
 await save("routes",doc); await ensureReverseRoutes(); res.json({ok:true,route:doc});
});
app.delete("/api/admin/routes/:id",admin,async(req,res)=>{await remove("routes",clip(req.params.id,80));res.json({ok:true});});
app.get("/api/admin/schedules",admin,async(_req,res)=>res.json(await all("schedules")));
app.post("/api/admin/schedules",admin,async(req,res)=>{const p=req.body||{};if(!p.routeId||!p.date||!p.time||!Number.isInteger(Number(p.capacity))||Number(p.capacity)<1)return res.status(400).json({error:"Route, date, departure time and seat capacity are required."});const d={_id:p.id||id(),routeId:clip(p.routeId,80),date:clip(p.date,10),time:clip(p.time,10),capacity:Number(p.capacity),bus:clip(p.bus,40)||"Mash Poa Coach",active:p.active!==false};await save("schedules",d);res.json({ok:true,schedule:d});});
app.delete("/api/admin/schedules/:id",admin,async(req,res)=>{await remove("schedules",clip(req.params.id,80));res.json({ok:true});});
// Counter sales: mark seats as already sold so customers see them as occupied.
async function resolveDeparture(scheduleId,date){const sid=clip(scheduleId,100);const t=await one("schedules",{_id:sid});if(!t)return null;if(t.recurring===true){const d=clip(date,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return null;return {schedule:t,effectiveId:t._id+"__"+d,date:d};}return {schedule:t,effectiveId:t._id,date:t.date};}
function parseSeatList(txt,max){const out=new Set();for(const part of String(txt||"").split(/[,\s]+/).filter(Boolean)){const m=part.match(/^(\d+)(?:-(\d+))?$/);if(!m)return null;const a=Number(m[1]),b=m[2]?Number(m[2]):a;if(a<1||b<a||b>max)return null;for(let i=a;i<=b;i++)out.add(String(i));}return [...out];}
app.get("/api/admin/seat-blocks",admin,async(req,res)=>{const d=await resolveDeparture(req.query.scheduleId,req.query.date);if(!d)return res.json([]);const list=(await all("bookings")).filter(b=>b.scheduleId===d.effectiveId&&b.status==="counter");res.json(list.map(b=>({ref:b.ref,seats:b.seats,note:b.note||"",createdAt:b.createdAt})));});
app.post("/api/admin/seat-blocks",admin,async(req,res)=>{const p=req.body||{};const d=await resolveDeparture(p.scheduleId,p.date);if(!d)return res.status(400).json({error:"Choose a departure and a valid travel date."});const seats=parseSeatList(p.seats,Number(d.schedule.capacity));if(!seats||!seats.length)return res.status(400).json({error:"Enter seat numbers like 1,2,5-8 (between 1 and "+d.schedule.capacity+")."});const taken=(await all("bookings")).filter(b=>b.scheduleId===d.effectiveId&&b.status!=="cancelled").flatMap(b=>b.seats||[]);const clash=seats.filter(x=>taken.includes(x));if(clash.length)return res.status(409).json({error:"Already taken: seat "+clash.join(", ")+"."});const route=await one("routes",{_id:d.schedule.routeId});const ref="CTR-"+crypto.randomBytes(3).toString("hex").toUpperCase();const doc={_id:ref,ref,routeId:d.schedule.routeId,scheduleId:d.effectiveId,from:route?.origin||"",to:route?.destination||"",date:d.date,time:d.schedule.time,bus:d.schedule.bus,seats,passengers:[],amount:0,status:"counter",note:clip(p.note,120),createdAt:Date.now()};await save("bookings",doc);res.json({ok:true,block:{ref,seats}});});
app.delete("/api/admin/seat-blocks/:ref",admin,async(req,res)=>{const b=await one("bookings",{_id:clip(req.params.ref,40)});if(!b||b.status!=="counter")return res.status(404).json({error:"Block not found."});await remove("bookings",b._id);res.json({ok:true});});
app.get("/api/admin/bookings",admin,async(_req,res)=>res.json((await all("bookings",{createdAt:-1})).slice(0,300)));
app.post("/api/bookings",async(req,res)=>{
 const p=req.body||{}; const route=await one("routes",{_id:clip(p.routeId,80)}); const requestedScheduleId=clip(p.scheduleId,100); let schedule=await one("schedules",{_id:requestedScheduleId}); if(!schedule&&requestedScheduleId.includes("__")){const splitAt=requestedScheduleId.lastIndexOf("__");const templateId=requestedScheduleId.slice(0,splitAt),travelDate=requestedScheduleId.slice(splitAt+2);const template=await one("schedules",{_id:templateId});if(template?.recurring===true&&travelDate.length===10&&travelDate[4]==="-"&&travelDate[7]==="-")schedule={...template,_id:requestedScheduleId,date:travelDate};}
 if(!route||!schedule||!route.active||!schedule.active)return res.status(400).json({error:"That route or departure is not available."});
 const passengers=Array.isArray(p.passengers)?p.passengers.slice(0,8).map(x=>({name:clip(x.name,100),phone:clip(x.phone,20)})):[];
 if(!passengers.length||passengers.some(x=>!x.name||!x.phone))return res.status(400).json({error:"Passenger names and phone numbers are required."});
 const booked=(await all("bookings")).filter(b=>b.scheduleId===schedule._id&&b.status!=="cancelled").reduce((n,b)=>n+(b.seats||[]).length,0);
 const seats=Array.isArray(p.seats)?[...new Set(p.seats.map(x=>clip(x,5)))]:[];
 if(!seats.length||seats.length!==passengers.length||booked+seats.length>schedule.capacity)return res.status(409).json({error:"Selected seats are not available. Refresh the seat map."});
 const taken=(await all("bookings")).filter(b=>b.scheduleId===schedule._id&&b.status!=="cancelled").flatMap(b=>b.seats||[]);
 if(seats.some(s=>taken.includes(s)))return res.status(409).json({error:"One or more seats were just taken. Please choose again."});
 const ref="MP-"+crypto.randomBytes(4).toString("hex").toUpperCase();
 const globalSettings=await one("settings",{_id:"global"}); const unitFare=Number(globalSettings?.override)||route.fare_kes;
 const booking={_id:id(),ref,routeId:route._id,scheduleId:schedule._id,from:route.origin,to:route.destination,date:schedule.date,time:schedule.time,bus:schedule.bus,seats,passengers,phone:passengers[0].phone,amount:unitFare*passengers.length,status:"pending_payment",createdAt:Date.now()};
 await save("bookings",booking); res.status(201).json({ok:true,booking});
});
app.get("/api/schedules",async(req,res)=>{const {from,to,date}=req.query;const travelDate=clip(date,10);const routes=(await all("routes")).filter(r=>r.active!==false&&r.origin.toLowerCase()===clip(from,80).toLowerCase()&&r.destination.toLowerCase()===clip(to,80).toLowerCase());const schedules=(await all("schedules")).filter(s=>s.active!==false&&(s.recurring===true||s.date===travelDate)&&routes.some(r=>r._id===s.routeId));const bookings=await all("bookings");const globalSettings=await one("settings",{_id:"global"});res.json(schedules.map(s=>{const r=routes.find(x=>x._id===s.routeId);const effectiveId=s.recurring===true?s._id+"__"+travelDate:s._id;const used=bookings.filter(b=>b.scheduleId===effectiveId&&b.status!=="cancelled").flatMap(b=>b.seats||[]);return {...s,_id:effectiveId,templateId:s.recurring===true?s._id:undefined,date:travelDate,route:r,availableSeats:Math.max(0,s.capacity-used.length),takenSeats:used,fare_kes:Number(globalSettings?.override)||r.fare_kes};}));});
app.get("/api/booking/:ref",async(req,res)=>{const b=await one("bookings",{ref:clip(req.params.ref,40)});if(!b)return res.status(404).json({error:"Booking not found"});res.json({ref:b.ref,from:b.from,to:b.to,date:b.date,time:b.time,seats:b.seats,amount:b.amount,status:b.status});});

// Persistent customer/agent chat. Customer messages never expose admin credentials.
const chats=new Map();
async function loadChats(){try{const list=await all("chats");list.forEach(c=>chats.set(c._id,c));}catch(e){console.error("Chat load:",e.message);}}
async function persistChat(c){try{await save("chats",c);}catch(e){console.error("Chat save:",e.message);}}
function push(c,msg){msg.id=id();msg.at=Date.now();msg.status="delivered";c.messages.push(msg);c.updatedAt=msg.at;if(msg.from==="customer")c.unread=(c.unread||0)+1;persistChat(c);io.to(c._id).emit("message",msg);io.of("/agent").emit("chat:update",publicChat(c));}
function publicChat(c){return {_id:c._id,name:c.name,phone:c.phone,bookingRef:c.bookingRef,bookingRefs:c.bookingRefs||(c.bookingRef?[c.bookingRef]:[]),unread:c.unread||0,updatedAt:c.updatedAt,messages:c.messages};}
const agents=io.of("/agent");
agents.use((socket,next)=>socket.handshake.auth?.password&&ADMIN_PASSWORD&&socket.handshake.auth.password===ADMIN_PASSWORD?next():next(new Error("Wrong password")));
const humanActivity = new Map();
async function replyWithAI(c) {
 if(!aiConfig.enabled||!process.env.GEMINI_API_KEY)return;
 const last=c.messages[c.messages.length-1]; if(!last||last.from!=="customer")return; if(Date.now()-(humanActivity.get(c._id)||0)<10*60*1000)return;
 try {
  const [routes,schedules,payment]=await Promise.all([all("routes"),all("schedules"),one("settings",{_id:"global"})]);
  const system="You are the Mash Poa Online Booking assistant. Be concise, polite and helpful. Only state routes, departure times and fares found in the supplied current Mash Poa data. If a route/departure is missing, say staff must confirm it. Never invent seats, fares, booking status, payment receipt or ticket numbers. Never say an M-Pesa STK Push was sent unless an authorized staff member has explicitly initiated it. Never ask for an M-Pesa PIN or password. A booking is not paid until the backend/admin verifies it.\nROUTES: "+JSON.stringify(routes)+"\\nSCHEDULES: "+JSON.stringify(schedules)+"\\nPAYMENT WORKFLOW: "+JSON.stringify(safePayment(payment))+"\\nADMIN NOTES: "+aiConfig.notes+"\\nIf paymentMode is admin, tell the customer an agent will send official payment instructions. If details are provided in automatic mode, repeat only the configured number/account and name.";
  const history=c.messages.slice(-12).map(m=>({role:m.from==="customer"?"user":"model",parts:[{text:clip(m.text,1200)}]}));
  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(aiConfig.model)+":generateContent",{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":process.env.GEMINI_API_KEY},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:history,generationConfig:{temperature:0.25,maxOutputTokens:450}})});
  const data=await response.json(); if(!response.ok)throw new Error(data.error?.message||"AI request failed");
  const answer=(data.candidates?.[0]?.content?.parts||[]).map(x=>x.text||"").join("").trim();
  if(answer&&c.messages[c.messages.length-1].id===last.id)push(c,{from:"agent",text:answer,ai:true});
 } catch(e){console.error("Mash Poa AI:",e.message);}
}
agents.on("connection",socket=>{
 socket.emit("chats",Array.from(chats.values()).map(publicChat));
 socket.on("chat:read",async chatId=>{const c=chats.get(chatId);if(c){c.unread=0;let ch=false;c.messages.forEach(m=>{if(m.from==="customer"&&m.status!=="seen"){m.status="seen";m.seenAt=Date.now();ch=true;}});await persistChat(c);if(ch)io.to(c._id).emit("status",{from:"customer",status:"seen",at:Date.now()});agents.emit("chat:update",publicChat(c));}});
 socket.on("agent:reply",p=>{const c=chats.get(p?.chatId);const msg=clip(p?.text,2000);if(c&&msg){humanActivity.set(c._id,Date.now());push(c,{from:"agent",text:msg});}});
 socket.on("agent:stk-initiated",p=>{const c=chats.get(p?.chatId);if(c&&c.bookingRef){humanActivity.set(c._id,Date.now());push(c,{from:"agent",type:"status",text:"An authorized Mash Poa agent has confirmed that the M-Pesa STK Push was initiated. Please check your phone. This message does not itself confirm payment."});}});
 socket.on("agent:payment",p=>{const c=chats.get(p?.chatId);if(!c)return;Promise.all([one("settings",{_id:"global"}),Promise.all((c.bookingRefs&&c.bookingRefs.length?c.bookingRefs:[c.bookingRef]).map(r=>one("bookings",{ref:r})))]).then(([s,bs])=>{const pay=safePayment(s);if(!pay.number)return socket.emit("agent:error","Save the global payment number in Admin Settings first.");const amount=Number(p.amount)||bs.filter(x=>x&&x.status!=="paid").reduce((n,x)=>n+Number(x.amount||0),0);if(!amount)return socket.emit("agent:error","Enter the booking amount before sending payment details.");push(c,{from:"agent",type:"payment",payment:{...pay,amount,bookingRef:c.bookingRef},text:"Official payment instructions"});});});
 socket.on("agent:paid",async p=>{const c=chats.get(p?.chatId);if(!c)return;const refs=[...new Set([...(c.bookingRefs||[]),clip(p.ref,40)])].filter(Boolean);let issued=0;humanActivity.set(c._id,Date.now());for(const r of refs){const b=await one("bookings",{ref:r});if(!b||b.status==="paid")continue;b.status="paid";b.paidAt=Date.now();await save("bookings",b);issued++;const ticket={ticketNo:"MP-"+crypto.randomBytes(4).toString("hex").toUpperCase(),ref:b.ref,passengers:b.passengers,from:b.from,to:b.to,date:b.date,time:b.time,seats:b.seats,amount:b.amount,bus:b.bus};push(c,{from:"agent",type:"ticket",ticket,text:"Your payment has been verified. Your Mash Poa ticket is ready."});}});
});
io.on("connection",socket=>{
 socket.on("customer:start",async p=>{const phone=clip(p?.phone,20),name=clip(p?.name,100);if(!phone)return;let c=Array.from(chats.values()).find(x=>x.phone===phone&&x.bookingRef===clip(p?.bookingRef,40));if(!c){c={_id:id(),name:name||"Guest",phone,bookingRef:clip(p?.bookingRef,40),messages:[],unread:0,createdAt:Date.now(),updatedAt:Date.now()};chats.set(c._id,c);await persistChat(c);}socket.join(c._id);socket.emit("chat:ready",{chatId:c._id,messages:c.messages});});
 socket.on("customer:message",p=>{const c=chats.get(clip(p?.chatId,40));const message=clip(p?.text,1500);if(c&&message){push(c,{from:"customer",text:message,cid:clip(p?.cid,40)});replyWithAI(c);}});
 socket.on("customer:seen",async chatId=>{const c=chats.get(clip(chatId,40));if(!c)return;let ch=false;c.messages.forEach(m=>{if(m.from!=="customer"&&m.status!=="seen"){m.status="seen";m.seenAt=Date.now();ch=true;}});if(ch){await persistChat(c);io.of("/agent").emit("chat:update",publicChat(c));}});
 socket.on("customer:booking",p=>{const c=chats.get(clip(p?.chatId,40));const ref=clip(p?.ref,40);if(c&&ref){c.bookingRef=ref;c.bookingRefs=[...new Set([...(c.bookingRefs||[]),ref])];push(c,{from:"customer",type:"booking",booking:{ref,from:clip(p.from,80),to:clip(p.to,80),date:clip(p.date,10),time:clip(p.time,10),seats:clip((p.seats||[]).join(", "),40),amount:Number(p.amount)||0},text:"Booking request "+ref});}});
});
// Every route is two-way: if A to B exists, B to A is created too (same fare, reversed stops, same departure times).
async function ensureReverseRoutes(){try{const rs=await all("routes"),sc=await all("schedules");const pairs=new Set(rs.map(r=>(r.origin+"|"+r.destination).toLowerCase()));let n=0;
for(const r of rs){const key=(r.destination+"|"+r.origin).toLowerCase();if(pairs.has(key))continue;const rid=r._id+"-REV";
await save("routes",{_id:rid,origin:r.destination,destination:r.origin,stops:[...(r.stops||[])].reverse(),fare_kes:r.fare_kes,active:r.active!==false});pairs.add(key);n++;
for(const d of sc.filter(x=>x.routeId===r._id)){await save("schedules",{...d,_id:String(d._id).startsWith(r._id)?rid+String(d._id).slice(r._id.length):d._id+"-REV",routeId:rid});}}
if(n)console.log("Mash Poa created",n,"return routes");}catch(e){console.error("Return route sync failed:",e.message);}}
async function seedRouteAndScheduleFiles(){try{const fs=require("fs");const routeData=JSON.parse(fs.readFileSync(path.join(__dirname,"routes.json"),"utf8"));const scheduleData=JSON.parse(fs.readFileSync(path.join(__dirname,"schedules.json"),"utf8"));if(!(await all("routes")).length){for(const r of routeData.routes||[])await save("routes",r);}if(!(await all("schedules")).length){for(const s of scheduleData.departures||[])await save("schedules",s);}
// Items flagged "addition" are added once to databases that already hold data, without overwriting admin edits or re-adding anything an admin deleted.
const seeded=(await one("settings",{_id:"seeded"}))||{_id:"seeded",ids:[]};const done=new Set(seeded.ids||[]);const haveR=new Set((await all("routes")).map(x=>x._id)),haveS=new Set((await all("schedules")).map(x=>x._id));let added=0;
for(const r of (routeData.routes||[]).filter(x=>x.addition)){if(done.has(r._id))continue;if(!haveR.has(r._id)){await save("routes",r);added++;}done.add(r._id);}
for(const s of (scheduleData.departures||[]).filter(x=>x.addition)){if(done.has(s._id))continue;if(!haveS.has(s._id)){await save("schedules",s);added++;}done.add(s._id);}
if(added||done.size!==(seeded.ids||[]).length){await save("settings",{_id:"seeded",ids:[...done]});}if(added)console.log("Mash Poa added",added,"new catalogue items");console.log("Mash Poa catalogue loaded:",(await all("routes")).length,"routes and",(await all("schedules")).length,"departure templates");}catch(e){console.error("Mash Poa route/schedule seed failed:",e.message);}}
(async()=>{if(process.env.MONGODB_URI){try{mongoClient=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});await mongoClient.connect();db=mongoClient.db(DB_NAME);console.log("Mash Poa database connected");}catch(e){console.error("MongoDB unavailable; running in memory until restart:",e.message);}}await seedRouteAndScheduleFiles();await ensureReverseRoutes();const savedAI=await one("settings",{_id:"ai"}); if(savedAI) aiConfig={enabled:!!savedAI.enabled,model:savedAI.model||aiConfig.model,notes:savedAI.notes||""}; await loadChats();server.listen(PORT,()=>console.log("Mash Poa listening on "+PORT));})();
// Single-page app routes: reloading or opening a link to a results/checkout page must load the site, not "Cannot GET".
app.get(/^\/(booking|checkout)(\/.*)?$/,(_req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({ok:false,error:"Unexpected server error"});});
