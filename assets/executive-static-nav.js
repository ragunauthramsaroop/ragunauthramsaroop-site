/* Static-first executive navigation.
   Pre-rendered public pages do not require React hydration to display content. */
(()=>{
  "use strict";
  const nav=document.querySelector(".shell .topbar .nav");
  const button=nav?.querySelector(".menu-button");
  const desktop=nav?.querySelector(".navlinks");
  if(!nav||!button||!desktop||document.getElementById("mobile-navigation"))return;
  const menu=document.createElement("div");
  menu.id="mobile-navigation";
  menu.className="mobile-menu";
  menu.hidden=true;
  for(const original of desktop.querySelectorAll("a")){
    const link=original.cloneNode(true);
    if(link.classList.contains("contact-chip"))link.classList.add("mobile-engage");
    menu.appendChild(link);
  }
  nav.appendChild(menu);
  const close=()=>{
    menu.hidden=true;
    button.setAttribute("aria-expanded","false");
    button.setAttribute("aria-label","Open menu");
  };
  button.addEventListener("click",()=>{
    const opening=menu.hidden;
    menu.hidden=!opening;
    button.setAttribute("aria-expanded",String(opening));
    button.setAttribute("aria-label",opening?"Close menu":"Open menu");
  });
  menu.addEventListener("click",event=>{
    if(event.target.closest("a"))close();
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&!menu.hidden){close();button.focus();}
  });
  document.addEventListener("pointerdown",event=>{
    if(!menu.hidden&&!nav.contains(event.target))close();
  });
  window.addEventListener("resize",()=>{
    if(window.innerWidth>980&&!menu.hidden)close();
  },{passive:true});
})();
