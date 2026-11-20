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
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Mash Poa Online Booking", database: db ? "connected" : "memory-or-not-configured" }));

let db = null;
let mongoClient = null;
const memory = { settings: [], routes: [], schedules: [], bookings: [], chats: [] };
const col = (name) => db ? db.collection(name) : null;
async function all(name, sort = {}) { const c=col(name); return c ? c.find({}).sort(sort).toArray() : memory[name]; }
async function one(name, query) { const c=col(name); return c ? c.findOne(query) : memory[name].find(x=>Object.entries(query).every(([k,v])=>x[k]===v)) || null; }
async function save(name, doc) {
  const c=col(name);
  if(c) { const {_id,...data}=doc; await c.updateOne({_id},{$set:data},{upsert:true}); return doc; }
  const i=memory[name].findIndex(x=>x._id===doc._id); if(i<0) memory[name].push(doc); else memory[name][i]=doc; return doc;
}
async function remove(name,id) { const c=col(name); if(c) return c.deleteOne({_id:id}); memory[name]=memory[name].filter(x=>x._id!==id); }
function admin(req,res,next) { if(!ADMIN_PASSWORD) return res.status(503).json({error:"Admin password is not configured. Set AGENT_PASSWORD in the hosting environment."}); if(req.get("x-admin-password")!==ADMIN_PASSWORD) return res.status(401).json({error:"Wrong password"}); next(); }
const clip=(v,n=300)=>String(v??"").trim().slice(0,n);
const id=()=>crypto.randomBytes(12).toString("hex");
const safePayment=s=>({type:s?.type||"paybill",number:s?.number||"",account:s?.account||"",accountName:s?.accountName||"Mash Poa",paymentMode:s?.paymentMode||"admin",override:Number(s?.override)||0});
app.get("/api/booking-config", async (_req,res)=>{res.json({configured:(await all("routes")).length>0, routes:await all("routes"), schedules:await all("schedules")});});
app.get("/api/payment-settings", async (_req,res)=>res.json(safePayment(await one("settings",{_id:"global"}))));
app.post("/api/admin/login",(req,res)=>{if(!ADMIN_PASSWORD)return res.status(503).json({ok:false,error:"Set AGENT_PASSWORD in hosting environment."});res.json({ok:req.get("x-admin-password")===ADMIN_PASSWORD});});
app.get("/api/admin/settings",admin,async(_req,res)=>res.json(safePayment(await one("settings",{_id:"global"}))));
app.put("/api/admin/settings",admin,async(req,res)=>{
 const p=req.body||{}; const type=["paybill","till","phone","bank"].includes(p.type)?p.type:"paybill";
 const paymentMode=["admin","automatic","stk"].includes(p.paymentMode)?p.paymentMode:"admin";
 const doc={_id:"global",type,number:clip(p.number,40),account:clip(p.account,60),accountName:clip(p.accountName,80)||"Mash Poa",paymentMode,override:Math.max(0,Number(p.override)||0),updatedAt:Date.now()};
 await save("settings",doc); res.json({ok:true,settings:safePayment(doc)});
});
app.get("/api/admin/routes",admin,async(_req,res)=>res.json(await all("routes")));
app.post("/api/admin/routes",admin,async(req,res)=>{
 const p=req.body||{}; const origin=clip(p.origin,80),destination=clip(p.destination,80),fare=Number(p.fare);
 if(!origin||!destination||origin.toLowerCase()===destination.toLowerCase()||!Number.isFinite(fare)||fare<=0) return res.status(400).json({error:"Enter a valid origin, destination and positive fare."});
 const doc={_id:p.id||id(),origin,destination,stops:Array.isArray(p.stops)?p.stops.map(x=>clip(x,80)).filter(Boolean):[],fare_kes:Math.round(fare),active:p.active!==false};
 await save("routes",doc); res.json({ok:true,route:doc});
});
app.delete("/api/admin/routes/:id",admin,async(req,res)=>{await remove("routes",clip(req.params.id,80));res.json({ok:true});});
app.get("/api/admin/schedules",admin,async(_req,res)=>res.json(await all("schedules")));
app.post("/api/admin/schedules",admin,async(req,res)=>{const p=req.body||{};if(!p.routeId||!p.date||!p.time||!Number.isInteger(Number(p.capacity))||Number(p.capacity)<1)return res.status(400).json({error:"Route, date, departure time and seat capacity are required."});const d={_id:p.id||id(),routeId:clip(p.routeId,80),date:clip(p.date,10),time:clip(p.time,10),capacity:Number(p.capacity),bus:clip(p.bus,40)||"Mash Poa Coach",active:p.active!==false};await save("schedules",d);res.json({ok:true,schedule:d});});
app.delete("/api/admin/schedules/:id",admin,async(req,res)=>{await remove("schedules",clip(req.params.id,80));res.json({ok:true});});
app.get("/api/admin/bookings",admin,async(_req,res)=>res.json((await all("bookings",{createdAt:-1})).slice(0,300)));
app.post("/api/bookings",async(req,res)=>{
 const p=req.body||{}; const route=await one("routes",{_id:clip(p.routeId,80)}); const schedule=await one("schedules",{_id:clip(p.scheduleId,80)});
 if(!route||!schedule||!route.active||!schedule.active)return res.status(400).json({error:"That route or departure is not available."});
 const passengers=Array.isArray(p.passengers)?p.passengers.slice(0,8).map(x=>({name:clip(x.name,100),phone:clip(x.phone,20)})):[];
 if(!passengers.length||passengers.some(x=>!x.name||!x.phone))return res.status(400).json({error:"Passenger names and phone numbers are required."});
 const booked=(await all("bookings")).filter(b=>b.scheduleId===schedule._id&&b.status!=="cancelled").reduce((n,b)=>n+(b.seats||[]).length,0);
 const seats=Array.isArray(p.seats)?[...new Set(p.seats.map(x=>clip(x,5)))]:[];
 if(!seats.length||seats.length!==passengers.length||booked+seats.length>schedule.capacity)return res.status(409).json({error:"Selected seats are not available. Refresh the seat map."});
 const taken=(await all("bookings")).filter(b=>b.scheduleId===schedule._id&&b.status!=="cancelled").flatMap(b=>b.seats||[]);
 if(seats.some(s=>taken.includes(s)))return res.status(409).json({error:"One or more seats were just taken. Please choose again."});
 const ref="MP-"+crypto.randomBytes(4).toString("hex").toUpperCase();
 const booking={_id:id(),ref,routeId:route._id,scheduleId:schedule._id,from:route.origin,to:route.destination,date:schedule.date,time:schedule.time,bus:schedule.bus,seats,passengers,phone:passengers[0].phone,amount:route.fare_kes*passengers.length,status:"pending_payment",createdAt:Date.now()};
 await save("bookings",booking); res.status(201).json({ok:true,booking});
});
app.get("/api/schedules",async(req,res)=>{const {from,to,date}=req.query;const routes=(await all("routes")).filter(r=>r.active!==false&&r.origin.toLowerCase()===clip(from,80).toLowerCase()&&r.destination.toLowerCase()===clip(to,80).toLowerCase());const schedules=(await all("schedules")).filter(s=>s.active!==false&&s.date===clip(date,10)&&routes.some(r=>r._id===s.routeId));const bookings=await all("bookings");res.json(schedules.map(s=>{const r=routes.find(x=>x._id===s.routeId);const used=bookings.filter(b=>b.scheduleId===s._id&&b.status!=="cancelled").flatMap(b=>b.seats||[]);return {...s,route:r,availableSeats:Math.max(0,s.capacity-used.length),takenSeats:used,fare_kes:r.fare_kes};}));});
app.get("/api/booking/:ref",async(req,res)=>{const b=await one("bookings",{ref:clip(req.params.ref,40)});if(!b)return res.status(404).json({error:"Booking not found"});res.json({ref:b.ref,from:b.from,to:b.to,date:b.date,time:b.time,seats:b.seats,amount:b.amount,status:b.status});});

// Persistent customer/agent chat. Customer messages never expose admin credentials.
const chats=new Map();
async function loadChats(){try{const list=await all("chats");list.forEach(c=>chats.set(c._id,c));}catch(e){console.error("Chat load:",e.message);}}
async function persistChat(c){try{await save("chats",c);}catch(e){console.error("Chat save:",e.message);}}
function push(c,msg){msg.id=id();msg.at=Date.now();c.messages.push(msg);c.updatedAt=msg.at;if(msg.from==="customer")c.unread=(c.unread||0)+1;persistChat(c);io.to(c._id).emit("message",msg);io.of("/agent").emit("chat:update",publicChat(c));}
function publicChat(c){return {_id:c._id,name:c.name,phone:c.phone,bookingRef:c.bookingRef,unread:c.unread||0,updatedAt:c.updatedAt,messages:c.messages};}
const agents=io.of("/agent");
agents.use((socket,next)=>socket.handshake.auth?.password&&ADMIN_PASSWORD&&socket.handshake.auth.password===ADMIN_PASSWORD?next():next(new Error("Wrong password")));
agents.on("connection",socket=>{
 socket.emit("chats",Array.from(chats.values()).map(publicChat));
 socket.on("chat:read",async chatId=>{const c=chats.get(chatId);if(c){c.unread=0;await persistChat(c);agents.emit("chat:update",publicChat(c));}});
 socket.on("agent:reply",p=>{const c=chats.get(p?.chatId);const msg=clip(p?.text,2000);if(c&&msg)push(c,{from:"agent",text:msg});});
 socket.on("agent:payment",p=>{const c=chats.get(p?.chatId);if(!c)return;one("settings",{_id:"global"}).then(s=>{const pay=safePayment(s);if(!pay.number)return socket.emit("agent:error","Save the global payment number in Admin Settings first.");push(c,{from:"agent",type:"payment",payment:{...pay,amount:Number(p.amount)||0,bookingRef:c.bookingRef},text:"Official payment instructions"});});});
 socket.on("agent:paid",async p=>{const c=chats.get(p?.chatId);if(!c)return;const b=await one("bookings",{ref:clip(p.ref,40)});if(!b||b.status==="paid")return; b.status="paid";b.paidAt=Date.now();await save("bookings",b);const ticket={ticketNo:"MP-"+crypto.randomBytes(4).toString("hex").toUpperCase(),ref:b.ref,passengers:b.passengers,from:b.from,to:b.to,date:b.date,time:b.time,seats:b.seats,amount:b.amount,bus:b.bus};push(c,{from:"agent",type:"ticket",ticket,text:"Your payment has been verified. Your Mash Poa ticket is ready."});});
});
io.on("connection",socket=>{
 socket.on("customer:start",async p=>{const phone=clip(p?.phone,20),name=clip(p?.name,100);if(!phone)return;let c=Array.from(chats.values()).find(x=>x.phone===phone&&x.bookingRef===clip(p?.bookingRef,40));if(!c){c={_id:id(),name:name||"Guest",phone,bookingRef:clip(p?.bookingRef,40),messages:[],unread:0,createdAt:Date.now(),updatedAt:Date.now()};chats.set(c._id,c);await persistChat(c);}socket.join(c._id);socket.emit("chat:ready",{chatId:c._id,messages:c.messages});});
 socket.on("customer:message",p=>{const c=chats.get(clip(p?.chatId,40));const message=clip(p?.text,1500);if(c&&message){push(c,{from:"customer",text:message});}});
 socket.on("customer:booking",p=>{const c=chats.get(clip(p?.chatId,40));const ref=clip(p?.ref,40);if(c&&ref){c.bookingRef=ref;push(c,{from:"customer",type:"booking",booking:{ref,from:clip(p.from,80),to:clip(p.to,80),date:clip(p.date,10),time:clip(p.time,10),seats:clip((p.seats||[]).join(", "),40),amount:Number(p.amount)||0},text:"Booking request "+ref});}});
});
(async()=>{if(process.env.MONGODB_URI){try{mongoClient=new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});await mongoClient.connect();db=mongoClient.db(DB_NAME);console.log("Mash Poa database connected");}catch(e){console.error("MongoDB unavailable; running in memory until restart:",e.message);}}await loadChats();server.listen(PORT,()=>console.log("Mash Poa listening on "+PORT));})();
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({ok:false,error:"Unexpected server error"});});
