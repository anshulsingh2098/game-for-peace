/* ---------- Garage (real 3D models) ---------- */
let G=null,gTok=0,gCur=null,gShadow=null;
const loader=new GLTFLoader();
const gc=$('#gc');
function initGL(){
  if(G)return G;
  const renderer=new THREE.WebGLRenderer({canvas:gc,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();
  scene.environment=new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(),0.04).texture;
  const camera=new THREE.PerspectiveCamera(32,1,0.1,200);
  const controls=new OrbitControls(camera,gc);
  Object.assign(controls,{enableDamping:true,enablePan:false,enableZoom:false,autoRotate:true,autoRotateSpeed:1.1,maxPolarAngle:Math.PI*0.49,minPolarAngle:Math.PI*0.25});
  const key=new THREE.DirectionalLight(0xffffff,1.5);key.position.set(-5,8,6);scene.add(key);
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  const gr=x.createRadialGradient(64,64,4,64,64,64);gr.addColorStop(0,'rgba(0,0,0,.55)');gr.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gr;x.fillRect(0,0,128,128);
  gShadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));
  gShadow.rotation.x=-Math.PI/2;gShadow.position.y=0.004;scene.add(gShadow);
  gc.addEventListener('pointerdown',()=>{controls.autoRotate=false});
  gc.addEventListener('pointerup',()=>{setTimeout(()=>{controls.autoRotate=true},2500)});
  new ResizeObserver(()=>{const r=gc.parentElement.getBoundingClientRect();if(!r.width)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()}).observe(gc.parentElement);
  G={renderer,scene,camera,controls};
  (function frame(){requestAnimationFrame(frame);if(screen==='garage'){controls.update();renderer.render(scene,camera)}})();
  return G;
}
function fit(obj){
  const {camera,controls}=G,box=new THREE.Box3().setFromObject(obj),size=box.getSize(new THREE.Vector3()),ctr=box.getCenter(new THREE.Vector3());
  obj.position.x-=ctr.x;obj.position.z-=ctr.z;obj.position.y-=box.min.y;
  const r=Math.max(size.x,size.z,size.y*1.5);
  const d=r*1.05/Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*0.62;
  camera.position.set(-d*0.72,size.y*0.55+d*0.26,-d*0.72);
  controls.target.set(0,size.y*0.42,0);controls.update();
  gShadow.scale.set(size.x*1.9,size.z*1.25,1);
}
function loadVehicle(v){
  if(v._p)return v._p;
  return v._p=fetch(v.file).then(r=>{if(!r.ok)throw new Error(r.status);return r.arrayBuffer()})
    .then(buf=>new Promise((ok,no)=>loader.parse(buf,'',g=>{v._g=g;ok(g)},no)));
}
async function showVehicle(){
  const v=VEHICLES[S.vehicle],tok=++gTok,ld=$('#gload');
  initGL();ld.textContent='Loading…';ld.classList.remove('done');
  try{await loadVehicle(v)}catch(e){ld.textContent='Could not load this vehicle';console.error(e);return}
  if(tok!==gTok)return;
  if(gCur)G.scene.remove(gCur);
  gCur=v._g.scene;G.scene.add(gCur);fit(gCur);
  buildPaint(v);ld.classList.add('done');
}
/* paint */
let carMask=null,carTex=null;
async function recolourCar(v,hex){
  if(!carMask){
    const img=new Image();img.src='assets/car_01_livery_mask.png';await img.decode();
    const cv=document.createElement('canvas');cv.width=img.width;cv.height=img.height;
    const cx=cv.getContext('2d');cx.drawImage(img,0,0);carMask={w:img.width,h:img.height,d:cx.getImageData(0,0,img.width,img.height).data};
    carMask.out=document.createElement('canvas');carMask.out.width=carMask.w;carMask.out.height=carMask.h;
  }
  const col=new THREE.Color(hex),B=[col.r,col.g,col.b].map(l=>Math.round(255*(l<=0.0031308?l*12.92:1.055*Math.pow(l,1/2.4)-0.055)));
  const S0=[206,211,218],cx=carMask.out.getContext('2d'),im=cx.createImageData(carMask.w,carMask.h),m=carMask.d,o=im.data;
  for(let i=0;i<m.length;i+=4){const a=m[i]/255;o[i]=S0[0]+(B[0]-S0[0])*a;o[i+1]=S0[1]+(B[1]-S0[1])*a;o[i+2]=S0[2]+(B[2]-S0[2])*a;o[i+3]=255}
  cx.putImageData(im,0,0);
  if(!carTex){carTex=new THREE.CanvasTexture(carMask.out);carTex.flipY=false;carTex.colorSpace=THREE.SRGBColorSpace;carTex.anisotropy=4;
    v._g.scene.traverse(o=>{if(o.isMesh)[].concat(o.material).forEach(mt=>{if(mt.name==='Paint_Livery'){mt.map=carTex;mt.needsUpdate=true}})})}
  else carTex.needsUpdate=true;
}
function applyPaint(v,hex){
  if(v.id==='car'){recolourCar(v,hex);return}
  if(!v._mats){v._mats=[];v._g.scene.traverse(o=>{if(o.isMesh)[].concat(o.material).forEach(m=>{if(v.paint.names.includes(m.name)&&!v._mats.includes(m))v._mats.push(m)})})}
  v._mats.forEach(m=>m.color.set(hex));
}
function buildPaint(v){
  const box=$('#swatches'),cur=(S.paint&&S.paint[v.id])||v.paint.colors[0];
  $('#paintLabel').textContent=v.paint.label;box.innerHTML='';
  v.paint.colors.forEach(c=>{
    const b=document.createElement('button');b.className='sw';b.style.background=c;b.setAttribute('aria-label',v.paint.label+' colour '+c);b.setAttribute('aria-pressed',c===cur);
    b.onclick=()=>{S.paint=S.paint||{};S.paint[v.id]=c;save();[...box.children].forEach(x=>x.setAttribute('aria-pressed',x===b));applyPaint(v,c)};
    box.appendChild(b);
  });
  if(cur!==v.paint.colors[0])applyPaint(v,cur);
}
function renderGarage(){
  if(S.vehicle>=VEHICLES.length||S.vehicle<0)S.vehicle=0;
  const v=VEHICLES[S.vehicle],st=v.s;
  $('#vTag').textContent=v.tag;$('#vName').textContent=v.name;$('#vDesc').textContent=v.desc;
  $('#stats').innerHTML=[['Speed',st.Speed,st.Top+' km/h'],['Acceleration',st.Accel],['Handling',st.Handling],['Grip',st.Grip]]
   .map(([n,val])=>`<div class="stat"><span>${n}</span><div class="bar"><i data-w="${val}"></i></div><output>${val}</output></div>`).join('');
  requestAnimationFrame(()=>requestAnimationFrame(()=>$$('.bar i').forEach(i=>i.style.width=i.dataset.w+'%')));
  $('#bIc').textContent=v.ic;$('#bName').textContent='Buff · '+v.buff[0];$('#bDesc').textContent=v.buff[1];
  $('#dots').innerHTML=VEHICLES.map((_,i)=>`<i class="${i===S.vehicle?'on':''}"></i>`).join('');
  document.documentElement.style.setProperty('--accent',v.color);
  showVehicle();
}
const cycle=d=>{S.vehicle=(S.vehicle+d+VEHICLES.length)%VEHICLES.length;save();renderGarage()};
$('#prev').onclick=()=>cycle(-1);$('#next').onclick=()=>cycle(1);
new MutationObserver(()=>{if($('#garage').classList.contains('on'))renderGarage()}).observe($('#garage'),{attributes:true,attributeFilter:['class']});

