function drawFilm(c,t,images){
  const paper="#f1e7d4",black="#20211d",red="#cc3f27",blue="#354a7b";
  const shot=t<2.9?0:t<5.55?1:2;
  box(c,0,0,W,H,shot===1?blue:paper);
  function camera(cx,cy,w,angle){
    const im=images.camera;if(!im)return;
    c.save();c.translate(cx,cy);c.rotate(angle);
    c.shadowColor="rgba(35,26,9,.23)";c.shadowBlur=9;c.shadowOffsetY=7;
    const h=w*im.height/im.width;c.drawImage(im,-w/2,-h/2,w,h);c.restore();
  }
  if(shot===0){
    type(c,"OBJECT STUDY   /   THE MOVIE CAMERA",35,51,15,mono,black);
    line(c,35,66,922,66,black);type(c,"Roll",28,263,205,bold,black);
    type(c,"film.",35,450,196,italic,red);
    camera(681+90*(1-ramp(t,0,.8)),272,454,-.09+.012*t);
    type(c,"Bell & Howell  ·  Director Series",36,510,17,serif,black);
  }else if(shot===1){
    camera(262,303,600+.8*(t-2.9)*15,-.14);
    type(c,"Look",575,194,86,italic,paper);type(c,"closer.",575,283,88,serif,paper);
    const e=ramp(t,3.15,.7);line(c,425,300,425+115*e,300+53*e,"#eec04d",3);
    type(c,"THE LENS",553,362,25,mono,"#f5ce69");
  }else{
    const gap=14;box(c,0,167,960,236,black);
    for(let i=-1;i<7;i++){
      const x=i*192-(1-ramp(t,5.55,.85))*166;
      box(c,x+gap,194,171,180,paper);
      const frame=(i+4)%4,scales=[161,287,432,230],shifts=[0,-30,-94,21];
      clip(c,x+gap,194,171,180,()=>camera(x+93+shifts[frame],283,scales[frame],(frame-1)*.11));
      for(let j=0;j<5;j++){box(c,x+j*38+9,173,18,10,paper);box(c,x+j*38+9,383,18,10,paper)}
    }
    type(c,"Frame by frame.",35,128,82,italic,black);
    type(c,"ONE OBJECT, IN MOTION",36,478,18,mono,black);
  }
  for(const at of [2.9,5.55])if(t>=at&&t<at+.25){
    const x=W*ramp(t,at,.25);c.fillStyle=red;c.beginPath();c.moveTo(x,0);
    for(let y=0;y<=550;y+=13)c.lineTo(x+Math.sin(y*1.7)*5,y);
    c.lineTo(W,H);c.lineTo(W,0);c.fill();
  }
  grain(c,.26);
}
