"use strict";
(() => {
  if (document.getElementById("appSidebarRoot")) return;
  const root=document.createElement("div");
  root.id="appSidebarRoot";
  root.innerHTML=`
    <button class="app-menu-toggle" id="appMenuToggle" type="button" aria-label="メニューを開く" aria-expanded="false">
      <span></span><span></span><span></span>
    </button>
    <div class="app-sidebar-backdrop" id="appSidebarBackdrop"></div>
    <aside class="app-sidebar-drawer" id="appSidebarDrawer" aria-hidden="true">
      <div class="app-sidebar-brand">テスト成績システム</div>
      <nav id="appSidebarLinks" aria-label="メインメニュー"></nav>
    </aside>`;
  document.body.appendChild(root);
  const toggle=root.querySelector("#appMenuToggle"),drawer=root.querySelector("#appSidebarDrawer"),backdrop=root.querySelector("#appSidebarBackdrop"),nav=root.querySelector("#appSidebarLinks");
  const close=()=>{root.classList.remove("is-open");toggle.setAttribute("aria-expanded","false");toggle.setAttribute("aria-label","メニューを開く");drawer.setAttribute("aria-hidden","true");};
  const open=()=>{root.classList.add("is-open");toggle.setAttribute("aria-expanded","true");toggle.setAttribute("aria-label","メニューを閉じる");drawer.setAttribute("aria-hidden","false");};
  toggle.addEventListener("click",()=>root.classList.contains("is-open")?close():open());
  backdrop.addEventListener("click",close);
  document.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
  const current=location.pathname.replace(/\\/$/,"")||"/";
  const menus={
    teacher:[
      ["ダッシュボード","/teacher/dashboard","home"],
      ["生徒管理","/teacher/students","users"],
      ["クラス管理","/teacher/classes","school"],
      ["テスト管理","/teacher/tests","file"],
      ["答案アップロード","/teacher/answers/upload","upload"],
      ["答案処理状況","/teacher/answers/processing","inbox"],
      ["未紐付け答案","/teacher/answers/unmatched","link"],
      ["採点ナビ","/teacher/marking","edit"],
      ["結果総括表","/teacher/results/summary","chart"],
      ["答案返却","/teacher/results/return","return"],
      ["公開設定","/teacher/tests/publish","publish"]
    ],
    student:[
      ["生徒機能一覧","/student","home"],
      ["成績管理","/student/tests","chart"],
    ],
    admin:[]
  };
  const render=(role)=>{
    const items=menus[role]||[];
    if(role==="admin"){
      nav.innerHTML='<p class="app-sidebar-note">管理者はシステム管理・メンテナンス専用です。成績・答案の業務画面は表示しません。</p>';
      return;
    }
    nav.innerHTML=items.map(([label,url])=>'<a class="app-sidebar-link '+(current===url||current.startsWith(url+"/")?'active':'')+'" href="'+url+'">'+label+'</a>').join("");
  };
  const start=async()=>{
    try{
      if(typeof window.getProfile!=="function")return;
      const profile=await window.getProfile();
      if(!profile)return;
      render(profile.role);
    }catch(error){console.warn("共通サイドバーの権限取得に失敗しました。",error);}
  };
  start();
  window.addEventListener("popstate",close);
})();