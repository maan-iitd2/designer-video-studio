/* A film is drawn on a fixed 960 × 540 canvas. All timing is in seconds. */
const W=960, H=540;
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>1-Math.pow(1-clamp(x),3);
const ramp=(t,start,length)=>ease((t-start)/length);
function box(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h)}
function type(c,words,x,y,size,face,color,align="left"){
  c.font=face.replace("SIZE",size+"px");c.textAlign=align;c.fillStyle=color;
  c.fillText(words,x,y);c.textAlign="left";
}
const serif="normal SIZE Georgia, serif", italic="italic SIZE Georgia, serif";
const bold="900 SIZE 'Arial Black', Arial, sans-serif", sans="600 SIZE Arial, sans-serif";
const mono="normal SIZE 'Courier New', monospace";
function line(c,x,y,a,b,color,width=1){
  c.beginPath();c.moveTo(x,y);c.lineTo(a,b);c.lineWidth=width;c.strokeStyle=color;c.stroke();
}
function circle(c,x,y,r,color){c.beginPath();c.arc(x,y,r,0,2*Math.PI);c.fillStyle=color;c.fill()}
function clip(c,x,y,w,h,paint){c.save();c.beginPath();c.rect(x,y,w,h);c.clip();paint();c.restore()}
function cover(c,img,x,y,w,h,zoom=1,focusX=.5,focusY=.5){
  if(!img){box(c,x,y,w,h,"#716e62");return}
  const scale=Math.max(w/img.width,h/img.height)*zoom;
  const dw=img.width*scale, dh=img.height*scale;
  clip(c,x,y,w,h,()=>c.drawImage(img,x-(dw-w)*focusX,y-(dh-h)*focusY,dw,dh));
}
let grainCanvas;
function grain(c,opacity=.12){
  if(!grainCanvas){
    grainCanvas=document.createElement("canvas");grainCanvas.width=128;grainCanvas.height=128;
    const g=grainCanvas.getContext("2d"),data=g.createImageData(128,128);let seed=37;
    for(let i=0;i<data.data.length;i+=4){seed=(Math.imul(1664525,seed)+1013904223)>>>0;
      data.data[i]=data.data[i+1]=data.data[i+2]=seed>>>24;data.data[i+3]=135}
    g.putImageData(data,0,0);
  }
  c.save();c.globalAlpha=opacity;c.fillStyle=c.createPattern(grainCanvas,"repeat");c.fillRect(0,0,W,H);c.restore();
}
