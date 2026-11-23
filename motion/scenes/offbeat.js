function drawFilm(c,t){
  const blue="#253bd3",milk="#fbefcc",red="#ff633d",dark="#111d4d";
  const beats=t*2, pulse=Math.exp(-6*(beats%1));
  const act=t<2.75?0:t<5.25?1:2;
  box(c,0,0,W,H,[blue,red,milk][act]);
  function label(words,x,y,color){type(c,words,x,y,15,mono,color)}
  if(act===0){
    label("A RHYTHM STUDY",34,50,milk);
    for(let i=0;i<13;i++){
      const x=426+i*43;const wave=Math.sin(t*3-i*.45);
      c.save();c.translate(x,244+wave*42);c.rotate(-.26+.12*wave);
      box(c,-9,-122-i*1.8,18,244+i*3.6,i%3===0?red:milk);c.restore();
    }
    type(c,"Off",29,282,205,bold,milk);
    type(c,"beat.",35,452,197,italic,milk);
    line(c,35,490,925,490,milk);
    for(let i=0;i<16;i++)box(c,35+i*56,501,Math.floor(beats)%16===i?39:9,4,i%4===0?red:milk);
  }else if(act===1){
    const words=["Cut.","Hold.","Shift.","Play.","Again."];
    const k=Math.min(4,Math.floor((t-2.75)*2));
    label("TEMPO    120 BPM",34,49,dark);
    const x=(1-ramp(t,2.75+k*.5,.25))*112;
    type(c,words[k],34+x,339,168,k%2===0?bold:italic,dark);
    for(let i=0;i<8;i++){
      const phase=(t-2.75)*3+i*.39;
      c.save();c.translate(733+i*21,245+Math.sin(phase)*35);c.rotate(.23*Math.cos(phase));
      box(c,-3,-63,6,126,i===k?milk:dark);c.restore();
    }
    for(let i=0;i<4;i++)circle(c,60+i*63,456,17+(i===k%4?12*pulse:0),i===k%4?milk:dark);
  }else{
    const s=ramp(t,5.25,.55);type(c,"In",30,231,177,italic,blue);
    clip(c,0,233,W,243,()=>type(c,"sync.",24,439+120*(1-s),219,bold,blue));
    const lock=ramp(t,5.7,1.35);
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6+(1-lock)*Math.sin(t*4+i)*.33;
      c.save();c.translate(748,268);c.rotate(a);box(c,-7,-115+(1-lock)*20,14,56,i%3===0?red:blue);c.restore();
    }
    c.save();c.translate(748,268);c.rotate((t-5.25)*Math.PI);
    line(c,0,12,0,-69,blue,3);circle(c,0,0,8,red);c.restore();
    label("END OF PHRASE",37,506,dark);
  }
  grain(c,.13);
}
