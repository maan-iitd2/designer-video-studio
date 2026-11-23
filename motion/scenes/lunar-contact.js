function drawFilm(c,t,images){
  const paper="#ede7d9",ink="#20221f",orange="#de5133";
  const page=t<3.05?0:t<5.5?1:2;
  box(c,0,0,W,H,paper);
  if(page===0){
    cover(c,images.portrait,451,0,509,540,1+.014*t,.54,.17);
    type(c,"APOLLO 11   /   PHOTOGRAPHIC RECORD",32,45,13,mono,ink);
    line(c,32,62,423,62,ink);
    type(c,"Lunar",24,226+22*(1-ramp(t,0,.65)),111,serif,ink);
    type(c,"contact.",24,332+28*(1-ramp(t,.12,.65)),108,italic,ink);
    box(c,32,364,122*ramp(t,.38,.8),5,orange);
    type(c,"Sea of Tranquility",32,460,24,serif,ink);
    type(c,"20 JULY 1969",33,490,13,mono,ink);
    for(let i=0;i<8;i++)box(c,444,24+i*67,12,1,orange);
  }else if(page===1){
    cover(c,images.footprint,0,0,W,H,1.03+.018*(t-3),.46,.59);
    box(c,33,36,250,38,paper);type(c,"DETAIL   /   AS11-40-5880",46,61,14,mono,ink);
    const progress=ramp(t,3.24,.7);
    circle(c,511,374,4,orange);
    line(c,511,374,511+148*progress,374-76*progress,orange,3);
    if(progress>.95){box(c,659,277,271,43,paper);type(c,"An impression in dust.",671,306,26,serif,ink)}
  }else{
    box(c,0,0,W,H,ink);type(c,"Contact sheet",34,86,64,italic,paper);
    type(c,"APOLLO 11  /  JULY 1969",923,73,14,mono,paper,"right");
    ["flag","footprint","portrait"].forEach((k,i)=>{
      const x=34+302*i,y=124+(1-ramp(t,5.5+.12*i,.6))*60;
      cover(c,images[k],x,y,283,297,1.015,.5,.15);type(c,["AS11-40-5875","AS11-40-5880","AS11-40-5903"][i],x,y+323,18,mono,paper);
    });
    const select=ramp(t,6.43,.45)+ramp(t,7.04,.45);
    box(c,34+302*select,459,58,3,orange);
    line(c,34,477,923,477,"#827e6e");type(c,"Photographs: NASA",34,505,15,mono,paper);
  }
  for(const at of [3.05,5.5]){if(t>=at&&t<at+.25)box(c,W*ramp(t,at,.25),0,W,H,paper)}
  grain(c,.14);
}
