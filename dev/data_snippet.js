/* ---------- Data ---------- */
/* Vehicles use the real models in assets/. Stats are 0-100 for the bars; Top is km/h. */
const VEHICLES=[
 {id:'car',file:'assets/car_01_gt.glb',name:'Dusk GT',tag:'Fast',color:'#6f9bff',ic:'⚡',
  desc:'Low, wide and quick. Stretch it out on the long straights.',
  s:{Speed:92,Accel:86,Handling:72,Grip:64,Top:240},buff:['Afterburn','A strong burst of speed for a few seconds.','Boost',14],
  paint:{label:'Stripe',colors:['#2846a4','#d62828','#f08a24','#2a9d5b','#16181d','#f2f2f2']}},
 {id:'truck',file:'assets/truck_01.glb',name:'Freight Hauler',tag:'Heavy',color:'#ff9a3d',ic:'▲',
  desc:'A big rig that never slows on a hill. Steady, planted and calm.',
  s:{Speed:34,Accel:28,Handling:30,Grip:84,Top:110},buff:['Hill Hauler','Holds full speed on climbs and ignores the shoulder.','Haul',12],
  paint:{label:'Body',names:['Paint_Cab','Paint_Trailer'],colors:['#e78027','#d62828','#1d6fe0','#2a9d5b','#f2f2f2','#3a3f4a']}},
 {id:'bike',file:'assets/bike_01.glb',name:'Volt Bike',tag:'Agile',color:'#b6f03c',ic:'✦',
  desc:'Sharp, light and electric. Leans into every curve.',
  s:{Speed:82,Accel:90,Handling:96,Grip:46,Top:200},buff:['Lean-In','Tighter turns with a gentle drift.','Lean',10],
  paint:{label:'Panels',names:['Paint_Panel'],colors:['#f5f7fb','#b6f03c','#f08a24','#d62828','#1d6fe0','#16181d']}}
];

