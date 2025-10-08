#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

/* ===================== helpers ===================== */
function pad2(n){return n<10?"0"+n:String(n);}
function secsToHMS(sec){sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;}
function escapeXML(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function safeNum(x,fallback=0){return Number.isFinite(x)?x:fallback;}

/* ===================== Perlin noise ===================== */
const Perlin=(()=>{const P=[151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
const perm=new Array(512);for(let i=0;i<512;i++)perm[i]=P[i&255];
function grad(h,x,y,z){const u=h<8?x:y,v=h<4?y:(h===12||h===14?x:z);return((h&1)?-u:u)+((h&2)?-v:v);}
const fade=t=>t*t*t*(t*(t*6-15)+10),lerp=(a,b,t)=>a+t*(b-a);
return{noise(x,y=0,z=0){let X=Math.floor(x)&255,Y=Math.floor(y)&255,Z=Math.floor(z)&255;x-=Math.floor(x);y-=Math.floor(y);z-=Math.floor(z);
const u=fade(x),v=fade(y),w=fade(z);
const A=(perm[X]+Y)&255,AA=(perm[A]+Z)&255,AB=(perm[A+1]+Z)&255,B=(perm[X+1]+Y)&255,BA=(perm[B]+Z)&255,BB=(perm[B+1]+Z)&255;
const gAA=grad(perm[AA],x,y,z),gBA=grad(perm[BA],x-1,y,z),gAB=grad(perm[AB],x,y-1,z),gBB=grad(perm[BB],x-1,y-1,z),
gAA1=grad(perm[AA+1],x,y,z-1),gBA1=grad(perm[BA+1],x-1,y,z-1),gAB1=grad(perm[AB+1],x,y-1,z-1),gBB1=grad(perm[BB+1],x-1,y-1,z-1);
const x1=lerp(gAA,gBA,u),x2=lerp(gAB,gBB,u),y1=lerp(x1,x2,v),x3=lerp(gAA1,gBA1,u),x4=lerp(gAB1,gBB1,u),y2=lerp(x3,x4,v);
return lerp(y1,y2,w);}}})();

/* ===================== Weather model ===================== */
const epochOffsetSeconds=Math.floor(Date.now()/1000)-performance.now()/1000;
function sampleWeather(off=0){const t=performance.now()/1000+epochOffsetSeconds+off-1753269629;
const i=Perlin.noise(t*2e-4)+.5,h=Math.pow(Perlin.noise(t*2e-4,123.4567)+.5,1.5),w=Perlin.noise(t*2e-5,525.2525)*Math.PI*2;
let wx="Clear";if(i<.3&&h<.5)wx="Clear";else if((i<.3||h<.65)&&h>=.5)wx="Cloudy";else if(((i>.3&&i<.7)||h<.7)&&h>=.65)wx="Overcast";else if(i>=.7&&h>=.7)wx="Stormy";
return{intensity:i,humidity:h,wind_direction:w,weather:wx,t};}

/* LA-time helpers (PST/PDT aware via timeZone option) */
function losAngelesNow(){
  const p=new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",hour12:false,hour:"numeric",minute:"numeric",second:"numeric"}).formatToParts(new Date());
  let h=0,m=0,s=0;for(const k of p){if(k.type==="hour")h=+k.value;if(k.type==="minute")m=+k.value;if(k.type==="second")s=+k.value;}
  const d=new Date();d.setHours(h,m,s,0);return d;
}
function laPlus(sec){const d=losAngelesNow();d.setSeconds(d.getSeconds()+sec);return d;}
function inTransitionWindow(d){const h=d.getHours(),m=d.getMinutes();return (h===4&&m>=10)||(h===5&&m<=50)||(h===16&&m>=10)||(h===17&&m<=50);}
function secondsUntilNextBoundary(d){const s=d.getHours()*3600+d.getMinutes()*60+d.getSeconds();
let target;if(inTransitionWindow(d))target=(d.getHours()<12)?21000:64200;else if(d.getHours()<16||(d.getHours()>=0&&d.getHours()<4))target=(d.getHours()<4)?15000:58200;else target=101400;
let delta=target-s;if(delta<0)delta+=86400;return delta;}

/* ===================== Temperature (internal only) ===================== */
function tempFAt(off=0){
  off=safeNum(off);
  const la=laPlus(off);
  if(!(la instanceof Date)||isNaN(la))return 70;
  const hour=(la.getHours())+(la.getMinutes())/60;
  const {intensity,humidity}=sampleWeather(off);
  const diurnal=Math.sin((hour-15)/24*2*Math.PI);
  const T=72+10*diurnal+10*(safeNum(intensity)-0.5)-6*(safeNum(humidity)-0.5);
  return Math.round(safeNum(T)*10)/10;
}

/* ===================== Barometric Pressure ===================== */
function baroInHg(off=0){
  const {intensity,humidity,weather}=sampleWeather(off);
  let p=29.92-0.8*(safeNum(intensity)-0.5)-0.6*(safeNum(humidity)-0.5);
  if(weather==="Stormy")p-=0.3;
  if(weather==="Overcast")p-=0.1;
  if(weather==="Clear")p+=0.1;
  return Math.round(p*100)/100;
}
function baroCondition(p){
  if(p<29.5)return"Falling rapidly";
  if(p<29.8)return"Falling";
  if(p<30.0)return"Steady";
  if(p<30.2)return"Rising";
  return"Rising rapidly";
}

/* ===================== Forecast Generation ===================== */
function laSecondsSinceMidnight(){const d=losAngelesNow();return d.getHours()*3600+d.getMinutes()*60+d.getSeconds();}
function dayStatsByDayIndex(i){
  const sod=laSecondsSinceMidnight();const start=-sod+i*86400;
  let tMax=-1e9,tMin=1e9;const cnts={Clear:0,Cloudy:0,Overcast:0,Stormy:0};
  for(let h=0;h<24;h++){const o=start+h*3600,T=tempFAt(o),w=sampleWeather(o).weather;
    tMax=Math.max(tMax,T);tMin=Math.min(tMin,T);cnts[w]=(cnts[w]||0)+1;}
  const order=["Stormy","Overcast","Cloudy","Clear"];let mode="Clear",best=-1;
  for(const k of order){const c=cnts[k]||0;if(c>best){best=c;mode=k;}}
  return{high:tMax,low:tMin,condition:mode};
}
function generate7DayForecastTextInternal(){
  const sod=laSecondsSinceMidnight();let out="NOW YOUR 7-DAY FORECAST...\n";
  for(let i=0;i<7;i++){
    const dayMid=-sod+i*86400;
    const dayName=laPlus(dayMid).toLocaleDateString("en-US",{weekday:"long"});
    const {high,low,condition}=dayStatsByDayIndex(i);
    const baro=baroInHg(i*86400);
    out+=`${dayName}: ${condition}. High near ${Math.round(high)}°F, Low around ${Math.round(low)}°F. Pressure ${baro} inHg (${baroCondition(baro)}).\n`;
  }
  return out.trim();
}

/* ===================== Storm finder ===================== */
function findNextStormWindow(){
  // scan next 48h
  let start=null,end=null;
  for(let s=0;s<172800;s++){ if(sampleWeather(s).weather==="Stormy"){ start=s; break; } }
  if(start===null) return null;
  end=start;
  for(let s=start;s<172800;s++){ if(sampleWeather(s).weather!=="Stormy"){ end=s; break; } }
  return { startIn:start, duration:end-start };
}

/* ===================== Build RSS ===================== */
function buildRSS(){
  const nowW = sampleWeather(0);
  const la = losAngelesNow();
  const inWin = inTransitionWindow(la);
  const until = secondsUntilNextBoundary(la);
  const storm = findNextStormWindow();

  const sevenDay = generate7DayForecastTextInternal();

  // Storm times in PST exact
  let storms;
  if(storm){
    const startPST = laPlus(storm.startIn).toLocaleTimeString("en-US",{timeZone:"America/Los_Angeles",hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true});
    const endPST   = laPlus(storm.startIn+storm.duration).toLocaleTimeString("en-US",{timeZone:"America/Los_Angeles",hour:"numeric",minute:"2-digit",second:"2-digit",hour12:true});
    storms = `STORM TIMES...
Next storm: ${startPST} – ${endPST} PST.`;
  } else {
    storms = `STORM TIMES...
No significant storms expected within 48 hours.`;
  }

  const blimpTxt = `BLIMP OPERATION TIMES...
Morning window: 04:10–05:50
Evening window: 16:10–17:50
Status: ${inWin ? "WITHIN WINDOW" : "OUT OF WINDOW"}
Time to next boundary: ${secsToHMS(until)}.`;

  // Optional human-entered observations (docs/observations.txt)
  const obsPath = path.join(__dirname,"..","docs","observations.txt");
  let obsBlock = "(no observations reported)";
  if (fs.existsSync(obsPath)) {
    const raw = fs.readFileSync(obsPath, "utf8").trim();
    if (raw) obsBlock = raw;
  }
  const baroNow = baroInHg(0);
  const baroTxt = `Barometer: ${baroNow} inHg (${baroCondition(baroNow)})`;

  const description = [
    sevenDay,
    storms,
    blimpTxt,
    `OBSERVATIONS FROM AROUND THE AREA:\n${obsBlock}`,
    baroTxt,
    `Report generated at ${new Date().toLocaleString("en-US",{timeZone:"America/Los_Angeles"})} (PST/PDT).`
  ].join("\n\n");

  const item = {
    title: `Forecast Update – ${nowW.weather} – ${new Date().toLocaleTimeString("en-US",{timeZone:"America/Los_Angeles"})}`,
    link: "https://example.invalid", // optional
    description,
    pubDateISO: new Date().toISOString(),
    guid: `crdg-${Date.now()}`
  };

  const itemsXML = `    <item>
      <title>${escapeXML(item.title)}</title>
      <link>${escapeXML(item.link)}</link>
      <description><![CDATA[${item.description}]]></description>
      <category>Weather Forecast</category>
      <pubDate>${new Date(item.pubDateISO).toUTCString()}</pubDate>
      <guid isPermaLink="false">${escapeXML(item.guid)}</guid>
    </item>`;

  const channelXML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>CRDG Weather Service Forecast</title>
    <link>https://github.com/</link>
    <description>Automated simulated CRDG forecast feed (NWS bulletin style).</description>
    <language>en-us</language>
    <generator>CRDG Automated Forecast Unit</generator>
    <ttl>5</ttl>
${itemsXML}
  </channel>
</rss>`;

  const outFile = path.join(__dirname,"..","docs","crdg_forecast.xml");
  fs.writeFileSync(outFile, channelXML, "utf8");
  console.log("Wrote", outFile);
}

buildRSS();
