const $ = (selector) => document.querySelector(selector);
const dateInput=$("#travel-date");
const now=new Date();const today=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,10);
dateInput.min=today;dateInput.value=today;$("#year").textContent=new Date().getFullYear();
$("#swap-route").addEventListener("click",()=>{const a=$("#origin"),b=$("#destination");[a.value,b.value]=[b.value,a.value]});
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
const results=document.createElement("section");results.id="journey-results";results.style.cssText="max-width:1064px;margin:0 auto 36px;padding:0 18px";$("#book").appendChild(results);
$("#route-form").addEventListener("submit",async e=>{
 e.preventDefault();const from=$("#origin").value.trim(),to=$("#destination").value.trim(),date=dateInput.value,feedback=$("#form-feedback");
 if(from.toLowerCase()===to.toLowerCase()){feedback.textContent="Choose two different locations for your journey.";return;}
 feedback.textContent="Checking Mash Poa departures…";results.innerHTML="";
 try{const r=await fetch("/api/schedules?"+new URLSearchParams({from,to,date}));const trips=await r.json();if(!r.ok)throw Error(trips.error||"Could not search departures.");
 if(!trips.length){feedback.textContent="No Mash Poa departures are published for this route and date yet. Please contact support or check another date.";return;}
 feedback.textContent=trips.length+" departure(s) found.";results.innerHTML='<h2 style="font:800 22px Manrope,sans-serif;color:#102d26;margin:16px 0">Available Mash Poa departures</h2>'+trips.map(t=>'<article style="background:#fff;border:1px solid #e5e9e2;border-radius:13px;padding:17px;margin:10px 0;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><b>'+esc(t.time)+' · '+esc(t.bus)+'</b><div style="font-size:12px;color:#718079;margin-top:5px">'+esc(t.route.origin)+' → '+esc(t.route.destination)+' · '+esc(t.date)+'</div><div style="font-size:12px;color:#55764c;margin-top:5px">'+t.availableSeats+' seats available</div></div><div style="text-align:right"><b style="color:#19483a">KES '+Number(t.fare_kes).toLocaleString()+'</b><div><button type="button" data-schedule="'+esc(t._id)+'" style="margin-top:8px;background:#102d26;color:#fff;border:0;border-radius:8px;padding:11px 15px;font-weight:700">Choose seats →</button></div></div></article>').join("");
 results.querySelectorAll("[data-schedule]").forEach(btn=>btn.addEventListener("click",()=>book(trips.find(t=>t._id===btn.dataset.schedule))));
 }catch(err){feedback.textContent=err.message||"We could not reach the booking service.";}
});
async function book(t){
 if(!t||!t.availableSeats){alert("This departure has no seats available.");return;}
 const count=Number(prompt("How many passengers? (1–8)","1"));if(!Number.isInteger(count)||count<1||count>8)return;if(count>t.availableSeats){alert("Not enough seats are available.");return;}
 const free=Array.from({length:t.capacity},(_,i)=>String(i+1)).filter(x=>!t.takenSeats.includes(x));
 const selected=prompt("Available seat numbers: "+free.join(", ")+"\nEnter "+count+" seat number(s), separated by commas.");
 if(!selected)return;const seats=[...new Set(selected.split(",").map(x=>x.trim()))];if(seats.length!==count||seats.some(x=>!free.includes(x))){alert("Please choose exactly "+count+" available seat number(s).");return;}
 const passengers=[];for(let i=0;i<count;i++){const name=prompt("Passenger "+(i+1)+" full name:");if(!name)return;passengers.push({name,phone:""});}
 const phone=prompt("Contact phone number (used for booking updates):");if(!phone)return;passengers.forEach(p=>p.phone=phone.trim());
 try{const r=await fetch("/api/bookings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({routeId:t.route._id,scheduleId:t._id,seats,passengers})});const d=await r.json();if(!r.ok)throw Error(d.error||"Could not create booking.");
 const booking=d.booking;alert("Booking request "+booking.ref+" created. Continue in Mash Poa support chat for payment instructions. Your booking is not confirmed until payment is verified.");
 window.dispatchEvent(new CustomEvent("mashpoa:booking",{detail:{ref:booking.ref,name:passengers[0].name,phone,from:booking.from,to:booking.to,date:booking.date,time:booking.time,seats:booking.seats,amount:booking.amount}}));
 }catch(err){alert(err.message);}
}
const panel=$("#chat-panel"),backdrop=$("#chat-backdrop");
function openSupport(){if(window.MashPoaChat){const b=$("#mp-chat-launch");if(b)b.click();}else{panel.classList.add("open");panel.setAttribute("aria-hidden","false");backdrop.hidden=false;}}
function closeSupport(){panel.classList.remove("open");panel.setAttribute("aria-hidden","true");backdrop.hidden=true;}
$("#open-help").addEventListener("click",openSupport);$("#close-chat").addEventListener("click",closeSupport);backdrop.addEventListener("click",closeSupport);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSupport();});
