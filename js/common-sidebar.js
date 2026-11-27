"use strict";
(() => {
  if (document.getElementById("appSidebarRoot")) return;
  const root=document.createElement("div");
  root.id="appSidebarRoot";
  root.innerHTML=`
    <button class="app-menu-toggle" id="appMenuToggle" type="button" aria-label="メニューを閉じる" aria-expanded="true">
      <span></span><span></span><span></span>
    </button>
    <div class="app-sidebar-backdrop" id="appSidebarBackdrop"></div>
    <aside class="app-sidebar-drawer" id="appSidebarDrawer" aria-hidden="false">
      <div class="app-sidebar-brand">テスト成績システム</div>
      <nav id="appSidebarLinks" aria-label="メインメニュー"></nav>
    </aside>`;
  document.body.appendChild(root);
  document.body.classList.add("has-app-sidebar");
  const toggle=root.querySelector("#appMenuToggle");
  const drawer=root.querySelector("#appSidebarDrawer");
  const backdrop=root.querySelector("#appSidebarBackdrop");
  const nav=root.querySelector("#appSidebarLinks");
  const desktop=()=>window.matchMedia("(min-width:701px)").matches;
  const setOpen=(open)=>{
    root.classList.toggle("is-open",open);
    document.body.classList.toggle("app-sidebar-collapsed",!open);
    toggle.setAttribute("aria-expanded",String(open));
    toggle.setAttribute("aria-label",open?"メニューを閉じる":"メニューを開く");
    drawer.setAttribute("aria-hidden",String(!open));
  };
  const close=()=>setOpen(false);
  const open=()=>setOpen(true);
  toggle.addEventListener("click",()=>root.classList.contains("is-open")?close():open());
  backdrop.addEventListener("click",close);
  document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
  const current=location.pathname.replace(/\/$/,"")||"/";
  const menus={
    teacher:[
      ["ダッシュボード","/teacher/dashboard"],
      ["生徒管理","/teacher/students"],
      ["クラス管理","/teacher/classes"],
      ["テスト管理","/teacher/tests"],
      ["答案アップロード","/teacher/answers/upload"],
      ["答案処理状況","/teacher/answers/processing"],
      ["未紐付け答案","/teacher/answers/unmatched"],
      ["紐付け済み答案","/teacher/answers/matched"],
      ["答案領域・クロップ","/teacher/answers/regions"],
      ["デジタル採点","/teacher/marking"],
      ["結果総括表","/teacher/results/summary"],
      ["答案返却","/teacher/results/return"],
      ["公開設定","/teacher/tests/publish"]
    ],
    student:[
      ["テスト一覧","/student/tests"]
    ],
    admin:[
      ["システム管理","/admin"]
    ]
  };
  const render=role=>{
    if(role==="admin"){
      nav.innerHTML='<p class="app-sidebar-note">管理者はシステム管理・メンテナンス専用です。成績・答案の業務画面は表示しません。</p><a class="app-sidebar-link '+(current==="/admin"?"active":"")+'" href="/admin">システム管理</a>';
      return;
    }
    nav.innerHTML=(menus[role]||[]).map(([label,url])=>'<a class="app-sidebar-link '+(current===url||current.startsWith(url+"/")?"active":"")+'" href="'+url+'">'+label+'</a>').join("");
  };
  const start=async()=>{
    try{
      if(typeof window.getProfile!=="function")return;
      const profile=await window.getProfile();
      if(profile)render(profile.role);
    }catch(error){console.warn("共通サイドバーの権限取得に失敗しました。",error);}
  };
  setOpen(desktop());
  start();
  window.addEventListener("resize",()=>{if(desktop()&&!root.classList.contains("is-open")&&!document.body.classList.contains("app-sidebar-collapsed"))open();});
  window.addEventListener("popstate",close);
})();