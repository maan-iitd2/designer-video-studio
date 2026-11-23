function drawFilm(c,t){
  const ink="#1d3025",paper="#f4f2e9",olive="#b1be80",peach="#f0a78c";
  const colors=["#1f3c31","#b2c487",peach,"#f0ddac","#617b83"];
  box(c,0,0,W,H,paper);
  function swatch(x,y,w,h,i,angle,selected){
    c.save();c.translate(x,y);c.rotate(angle);c.shadowColor="#23382433";c.shadowBlur=11;c.shadowOffsetY=5;
    box(c,-w/2,-h/2,w,h,"#fffdf8");c.shadowColor="transparent";
    box(c,-w/2+7,-h/2+7,w-14,h-45,colors[i]);
    clip(c,-w/2+7,-h/2+7,w-14,h-45,()=>{
      c.strokeStyle=["#466653","#879e67","#c97c65","#c1a675","#475e68"][i];
      c.lineWidth=1.5;
      for(let j=0;j<9;j++){
        c.beginPath();c.ellipse(-w*.15+i*10,h*.17,20+j*12,38+j*10,-.48-i*.19,0,Math.PI*2);c.stroke();
      }
    });
    type(c,["Pine","Lichen","Apricot","Oat","Slate"][i],-w/2+13,h/2-13,17,serif,ink);
    if(selected)circle(c,w/2-17,h/2-18,3,ink);c.restore();
  }
  if(t<3.6){
    const flatten=ramp(t,2.75,.75);
    box(c,-384*flatten,0,384,H,ink);
    c.save();c.translate(-384*flatten,0);
    type(c,"STUDIO MATERIALS",27,50,15,mono,olive);
    type(c,"Swatch",20,263,82,serif,paper);type(c,"book.",26,345,91,italic,paper);
    type(c,"A pocket colour library.",29,480,20,serif,paper);
    c.restore();
    if(flatten>0){c.save();c.globalAlpha=flatten;type(c,"Choose a colour",36,100,56,serif,ink);c.restore()}
    for(let i=0;i<5;i++){
      const spread=ramp(t,.07*i,.94);
      const x=637+(i-2)*66*spread,y=278+Math.abs(i-2)*10;
      swatch(x+(115+i*181-x)*flatten,y+(290-y)*flatten,166-15*flatten,243-32*flatten,i,(i-2)*.14*spread*(1-flatten),false);
    }
  }else if(t<5.65){
    type(c,"Choose a colour",36,100,56,serif,ink);
    for(let i=0;i<5;i++)swatch(115+i*181,290-(i===2?22*ramp(t,3.7,.6):0),151,211,i,0,i===2);
    let x=785-266*ramp(t,3.6,.63);
    c.fillStyle=ink;c.beginPath();c.moveTo(x,300);c.lineTo(x+5,329);c.lineTo(x+13,320);c.lineTo(x+24,319);c.fill();
    if(t>4.23){box(c,352,445,256,45,ink);type(c,"Apricot added",480,476,24,sans,paper,"center")}
    if(t>5.12){const grow=ramp(t,5.12,.53);box(c,477*(1-grow),252*(1-grow),W*grow,H*grow,peach)}
  }else{
    box(c,0,0,W,H,peach);
    type(c,"Saved palette",36,71,38,italic,ink);
    const widths=[.27,.22,.2,.18,.13];let x=38;
    for(let i=0;i<5;i++){const w=884*widths[i];let e=ramp(t,5.65+.07*i,.6);const top=126+202*(1-e);box(c,x,top,w-4,202*e,colors[i]);if(i===2){c.strokeStyle=ink;c.lineWidth=2;c.strokeRect(x+1,top,w-6,202*e)}x+=w}
    type(c,"Field study",31,445,103,serif,ink);
    type(c,"5 COLOURS",40,500,19,mono,ink);
    const mark=ramp(t,6.85,.55);line(c,798,479,798+84*mark,479,ink,2);
    if(mark>.9)type(c,"Saved",926,486,21,italic,ink,"right");
  }
  grain(c,.09);
}
