
(() => {
  const API_URL = "https://script.google.com/macros/s/AKfycbzma6piL2URnt-8LToDYCvDBj3ud_YISuYLdJLZRSWQJf2Wh7FKc1ygAJwHrLya64lzag/exec";
  const CACHE_KEY = "project_crm_shared_cache_v24";
  const sessionKey = "project_crm_shared_session_v24";

  const seed = {
    users: [
      {id:"u_admin",name:"Административные правки",login:"admin",password:"admin123",role:"admin",phone:"",active:true},
      
      {id:"u_view",name:"Наблюдатель",login:"viewer",password:"viewer123",role:"viewer",phone:"",active:true}
    ],
    defaultStages:["Начальная","Развитие","Слияние","Залив. инф","Пред. предлог","72 часа"],
    blockOptions:["Блок 1","Блок 2","Блок 3","Блок 4","Блок 5"],
    managerConfigs:{
      "u_mgr1":{
        notebook:"",
        messages:["Сообщение от начальства №1","Сообщение от начальства №2"],
        thesisTemplates:[
          {id:"tt_1",stageIndex:0,text:"Первичное знакомство"},
          {id:"tt_2",stageIndex:1,text:"Цели и планы"},
          {id:"tt_3",stageIndex:1,text:"Текущая занятость"}
        ],
        blockTemplates:[
          {id:"bt_1",stageIndex:0,text:"Путешествия"},
          {id:"bt_2",stageIndex:1,text:"Окружение"}
        ]
      }
    },
    clients:[
      {id:"c1",number:1,name:"Иван",gender:"male",block:"",blockReaction:"",blockRecords:[{block:"Блок 1",reaction:"Положительная",comments:[{ts:"2026-08-30T18:21:00",text:"Хорошо воспринял информацию по первому блоку.",authorName:"Александр"}]},{block:"Блок 2",reaction:"Негативная",comments:[{ts:"2026-08-31T10:15:00",text:"По второму блоку возникли возражения.",authorName:"Александр"}]}],discussion:"Познакомились, обсудили цели",notes:"Перезвонить после выходных",nick:"ivan",age:"34",managerId:"u_mgr1",profession:"Предприниматель",interests:"Путешествия",startDate:"2026-08-23",lastContact:"2026-08-30",nextContact:"2026-09-01",stageIndex:2,stages:["Начальная","Развитие","Слияние","Залив. инф","Пред. предлог","72 часа"],deleted:false,history:[
        {ts:"2026-08-30T18:21:00",text:"Добавлен комментарий: «Обсудили дополнительный доход»"},
        {ts:"2026-08-28T15:07:00",text:"Создан проект"}
      ]},
      {id:"c2",number:2,name:"Анна",gender:"female",block:"",blockReaction:"",blockRecords:[{block:"Блок 1",reaction:"Нейтральная",comments:[{ts:"2026-08-27T12:30:00",text:"Первичная реакция без явного интереса.",authorName:"Александр"}]}],discussion:"Обсудили текущую ситуацию",notes:"Вернуться к разговору позже",nick:"anna",age:"29",managerId:"u_mgr1",profession:"Маркетолог",interests:"Спорт",startDate:"2026-08-27",lastContact:"2026-08-30",nextContact:"2026-09-02",stageIndex:4,stages:["Начальная","Развитие","Слияние","Залив. инф","Пред. предлог","72 часа"],deleted:false,history:[{ts:"2026-08-27T12:00:00",text:"Создан проект"}]}
    ],
    audit:[]
  };


  let db = JSON.parse(JSON.stringify(seed));
  // Безопасная инициализация локального кэша: ошибка localStorage больше не роняет весь сайт.
  try{
    const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");
    if(cached && Array.isArray(cached.users)) db=cached;
  }catch(e){
    console.warn("Cache read failed:",e);
  }
  try{
    if(localStorage.getItem("citadel_reset_version")!=="v56_projects_reset_001"){
      db.clients=[];
      localStorage.setItem(CACHE_KEY,JSON.stringify(db));
      localStorage.setItem("citadel_reset_version","v56_projects_reset_001");
    }
  }catch(e){
    console.warn("Reset marker failed:",e);
  }
  let session = loadSession();
  let syncing = false;
  let realtimeTimer=null;
  function stopRealtime(){if(realtimeTimer){clearInterval(realtimeTimer);realtimeTimer=null;}}

  function loadSession(){
    try{ return JSON.parse(localStorage.getItem(sessionKey)||"null") }catch(e){ return null }
  }
  function setSession(s){
    session=s;
    localStorage.setItem(sessionKey,JSON.stringify(s));
    render();
  }
  function logout(){
    stopRealtime();
    session=null;
    localStorage.removeItem(sessionKey);
    render();
  }
  async function api(action,payload={}){
    const isRead=["getState","getManagerData"].includes(action);
    const attempts=action==="login"?2:(isRead?1:2);
    let lastError=null;
    for(let attempt=1;attempt<=attempts;attempt++){
      const controller=new AbortController();
      const timeoutMs=(action==="login")?12000:(isRead?7000:15000);
      const timer=setTimeout(()=>controller.abort(),timeoutMs);
      try{
        const r=await fetch(API_URL,{
          method:"POST",
          headers:{"Content-Type":"text/plain;charset=utf-8"},
          body:JSON.stringify({action,token:session?.token||"",...payload}),
          signal:controller.signal,
          cache:"no-store"
        });
        const text=await r.text();
        let data={};
        try{data=text?JSON.parse(text):{}}catch(_){throw new Error("Сервер вернул некорректный ответ");}
        if(!r.ok || data.ok===false) throw new Error(data.error||"Ошибка сервера");
        return data;
      }catch(e){
        lastError=e;
        const msg=String(e?.message||e||"");
        if(/неверный логин|неверный пароль|нет доступа|заблокирован/i.test(msg) || attempt===attempts) break;
        await new Promise(r=>setTimeout(r,700*attempt));
      }finally{clearTimeout(timer);}
    }
    if(lastError?.name==="AbortError") throw new Error("Сервер долго отвечает. Попробуйте войти ещё раз.");
    throw lastError||new Error("Нет связи с сервером");
  }
  function isUnknownActionError(e){
    const s=String(e?.message||e||"").toLowerCase();
    return s.includes("неизвест") || s.includes("unknown action");
  }

  // Совместимость с предыдущим развёртыванием Apps Script.
  // Если новые точечные действия ещё не опубликованы, сайт автоматически
  // использует старые getState/saveState вместо показа ошибки.
  async function getManagerDataCompat(managerId){
    try{
      return await api("getManagerData",{managerId});
    }catch(e){
      if(!isUnknownActionError(e)) throw e;
      const data=await api("getState");
      if(data.state){
        db=data.state;
        localStorage.setItem(CACHE_KEY,JSON.stringify(db));
      }
      return {ok:true,config:managerConfig(managerId)};
    }
  }

  async function saveNotebookCompat(text,clientUpdatedAt){
    try{
      return await api("saveNotebook",{text,clientUpdatedAt});
    }catch(e){
      if(!isUnknownActionError(e)) throw e;
      const me=db.users.find(u=>u.id===session.userId);
      const cfg=managerConfig(me.id);
      cfg.notebook=String(text||"");
      cfg.notebookUpdatedAt=clientUpdatedAt||nowISO();
      const ok=await syncRemote(false);
      if(!ok) throw new Error("Не удалось сохранить блокнот");
      return {ok:true,config:managerConfig(me.id)};
    }
  }

  async function sendMessageCompat(managerId,text){
    try{
      return await api("sendMessage",{managerId,text});
    }catch(e){
      if(!isUnknownActionError(e)) throw e;
      // Подтягиваем последнюю базу перед записью, чтобы не затереть чужие данные.
      const stateData=await api("getState");
      if(stateData.state) db=stateData.state;
      const me=db.users.find(u=>u.id===session.userId);
      const cfg=managerConfig(managerId);
      const kind=me.role==="admin"?"admin":"observer";
      cfg.inbox[kind]={
        id:uid("msg_"),
        text:String(text||""),
        sentAt:nowISO(),
        readAt:""
      };
      localStorage.setItem(CACHE_KEY,JSON.stringify(db));
      const ok=await syncRemote(false);
      if(!ok) throw new Error("Не удалось сохранить сообщение");
      return {ok:true,config:managerConfig(managerId)};
    }
  }

  async function markMessageReadCompat(kind,messageId){
    try{
      return await api("markMessageRead",{kind,messageId});
    }catch(e){
      if(!isUnknownActionError(e)) throw e;
      const me=db.users.find(u=>u.id===session.userId);
      const cfg=managerConfig(me.id);
      const msg=cfg.inbox[kind];
      if(msg && String(msg.id||"")===String(messageId||"")){
        msg.readAt=nowISO();
        await syncRemote(false);
      }
      return {ok:true,config:managerConfig(me.id)};
    }
  }

  async function updateManagerAccountAtomic(managerId,payload){
    const data=await api("updateManagerAccount",{
      managerId,
      name:payload.name,
      login:payload.login,
      password:payload.password,
      avatar:payload.avatar
    });
    if(data.state){
      db=data.state;
      localStorage.setItem(CACHE_KEY,JSON.stringify(db));
    }
    return data;
  }

  async function saveManagerStatisticsAtomic(managerId,rows){
    const data=await api("saveManagerStatistics",{managerId,rows});
    if(data.state){
      db=data.state;
      try{localStorage.setItem(CACHE_KEY,JSON.stringify(db));}catch(_){}
    }else if(data.config){
      db.managerConfigs=db.managerConfigs||{};
      db.managerConfigs[managerId]=data.config;
      try{localStorage.setItem(CACHE_KEY,JSON.stringify(db));}catch(_){}
    }
    return data;
  }

  async function deleteProjectForeverAtomic(projectId){
    const data=await api("deleteProjectForever",{projectId});
    if(data.state){
      db=data.state;
      try{localStorage.setItem(CACHE_KEY,JSON.stringify(db));}catch(_){}
    }
    return data;
  }

  async function renumberProjectAtomic(projectId,newNumber){
    const data=await api("renumberProject",{projectId,newNumber});
    if(data.state){
      db=data.state;
      try{localStorage.setItem(CACHE_KEY,JSON.stringify(db));}catch(_){}
    }else if(data.project){
      db.clients=Array.isArray(db.clients)?db.clients:[];
      const idx=db.clients.findIndex(x=>String(x.id)===String(projectId));
      if(idx>=0)db.clients[idx]=data.project;
      try{localStorage.setItem(CACHE_KEY,JSON.stringify(db));}catch(_){}
    }
    return data;
  }

  async function saveManagerSettingsAtomic(managerId){
    const cfg=managerConfig(managerId);
    const payload={
      managerId,
      progressScaleTitle:cfg.progressScaleTitle,
      funnelStages:cfg.funnelStages,
      thesisTemplates:cfg.thesisTemplates,
      blockTemplates:cfg.blockTemplates,
      markers:cfg.markers||[]
    };
    try{
      const data=await api("saveManagerSettings",payload);
      if(data.state){
        db=data.state;
        localStorage.setItem(CACHE_KEY,JSON.stringify(db));
      }else if(data.config){
        db.managerConfigs=db.managerConfigs||{};
        db.managerConfigs[managerId]=data.config;
        localStorage.setItem(CACHE_KEY,JSON.stringify(db));
      }
      return true;
    }catch(e){
      if(!isUnknownActionError(e)) throw e;
      // Совместимость со старым backend.
      syncManagerTemplates(managerId);
      return await syncRemote(false);
    }
  }

  async function createTrainingAccountAtomic(payload){
    const data=await api("createTrainingAccount",payload);
    if(data.state){db=data.state;localStorage.setItem(CACHE_KEY,JSON.stringify(db));}
    return data;
  }
  async function uploadTrainingFileAtomic(traineeId,file,title){
    const base64=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||"").split(",").pop()||"");
      reader.onerror=()=>reject(reader.error||new Error("Не удалось прочитать файл"));
      reader.readAsDataURL(file);
    });
    const data=await api("uploadTrainingFile",{traineeId,title:title||file.name,fileName:file.name,mimeType:file.type||"application/octet-stream",dataBase64:base64});
    if(data.state){db=data.state;localStorage.setItem(CACHE_KEY,JSON.stringify(db));}
    return data;
  }
  async function deleteTrainingFileAtomic(traineeId,fileId){
    const data=await api("deleteTrainingFile",{traineeId,fileId});
    if(data.state){db=data.state;localStorage.setItem(CACHE_KEY,JSON.stringify(db));}
    return data;
  }
  async function markTrainingFileReadAtomic(fileId){
    const data=await api("markTrainingFileRead",{fileId});
    if(data.state){db=data.state;localStorage.setItem(CACHE_KEY,JSON.stringify(db));}
    return data;
  }
  async function deleteTrainingAccountAtomic(traineeId){
    const data=await api("deleteTrainingAccount",{traineeId});
    if(data.state){db=data.state;localStorage.setItem(CACHE_KEY,JSON.stringify(db));}
    return data;
  }
  function trainingProgram(userId){
    db.trainingPrograms=db.trainingPrograms&&typeof db.trainingPrograms==="object"?db.trainingPrograms:{};
    const p=db.trainingPrograms[userId]||{files:[],readFileIds:[],createdAt:""};
    p.files=Array.isArray(p.files)?p.files:[];
    p.readFileIds=Array.isArray(p.readFileIds)?p.readFileIds:[];
    return p;
  }
  function trainingProgress(userId){
    const p=trainingProgram(userId), total=p.files.length, readSet=new Set(p.readFileIds.map(String));
    const done=p.files.filter(f=>readSet.has(String(f.id))).length;
    return {total,done,percent:total?Math.round(done/total*100):0};
  }

  async function deleteAdminProjectCommentAtomic(projectId,commentId){
    const data=await api("deleteAdminProjectComment",{projectId,commentId});
    if(data.project){
      const idx=(db.clients||[]).findIndex(x=>x.id===projectId);
      if(idx>=0) db.clients[idx]=data.project;
      localStorage.setItem(CACHE_KEY,JSON.stringify(db));
    }
    return data;
  }

  async function clearAdminManagerMessageAtomic(managerId){
    const data=await api("clearAdminMessage",{managerId});
    if(data.config){
      db.managerConfigs=db.managerConfigs||{};
      db.managerConfigs[managerId]=data.config;
      localStorage.setItem(CACHE_KEY,JSON.stringify(db));
    }
    return data;
  }

  async function addBlockCommentAtomic(projectId,blockId,blockText,text){
    try{
      const data=await api("addBlockComment",{projectId,blockId,blockText,text});
      if(data.project){
        db.clients=Array.isArray(db.clients)?db.clients:[];
        const idx=db.clients.findIndex(x=>String(x.id)===String(projectId));
        if(idx>=0) db.clients[idx]=data.project;
        try{localStorage.setItem(CACHE_KEY,JSON.stringify(db));}catch(_){}
      }
      return data;
    }catch(e){
      // Совместимость со старой опубликованной версией Apps Script:
      // если addBlockComment ещё не развёрнут, сохраняем комментарий через общий saveState.
      if(!isUnknownActionError(e)) throw e;

      db.clients=Array.isArray(db.clients)?db.clients:[];
      const idx=db.clients.findIndex(x=>String(x.id)===String(projectId));
      if(idx<0) throw new Error("Проект не найден");

      const project=db.clients[idx];
      project.blockComments=Array.isArray(project.blockComments)?project.blockComments:[];
      project.history=Array.isArray(project.history)?project.history:[];

      const me=(db.users||[]).find(u=>String(u.id)===String(session.userId));
      const ts=nowISO();
      const comment={
        id:uid("bcmt_"),
        blockId:String(blockId||""),
        blockText:String(blockText||"Блок"),
        text:String(text||"").trim(),
        ts,
        authorId:me?.id||"",
        authorName:me?.name||me?.login||"Пользователь"
      };

      project.blockComments.push(comment);
      project.history.push({
        ts,
        type:"block_comment",
        actorName:comment.authorName,
        text:`Комментарий к блоку «${comment.blockText}»: «${comment.text}»`
      });

      try{localStorage.setItem(CACHE_KEY,JSON.stringify(db));}catch(_){}
      const ok=await syncRemote(false);
      if(!ok){
        project.blockComments=project.blockComments.filter(x=>x.id!==comment.id);
        project.history=project.history.filter(x=>!(x.ts===ts && x.type==="block_comment" && x.text.includes(comment.text)));
        throw new Error("Сервер не подтвердил сохранение");
      }
      return {ok:true,project};
    }
  }

  async function addAdminProjectCommentAtomic(projectId,text){
    const data=await api("addAdminProjectComment",{projectId,text});
    if(data.project){
      const idx=(db.clients||[]).findIndex(x=>x.id===projectId);
      if(idx>=0) db.clients[idx]=data.project;
      localStorage.setItem(CACHE_KEY,JSON.stringify(db));
    }
    return data;
  }

  async function saveProjectChecklistBatch(projectId,theses,blocks){
    const payload={
      projectId:String(projectId||""),
      theses:(Array.isArray(theses)?theses:[]).map(x=>({id:String(x.id||""),done:x.done!==false})),
      blocks:(Array.isArray(blocks)?blocks:[]).map(x=>({id:String(x.id||""),done:x.done!==false}))
    };

    // Основной путь — атомарное сохранение только этого проекта.
    try{
      const data=await api("saveProjectChecklist",payload);
      if(!data || data.ok===false) throw new Error(data?.error||"Сервер не подтвердил сохранение");

      if(data.project){
        if(!db || typeof db!=="object") throw new Error("Локальная база не инициализирована");
        db.clients=Array.isArray(db.clients)?db.clients:[];
        const idx=db.clients.findIndex(x=>String(x.id)===String(projectId));
        if(idx>=0) db.clients[idx]=data.project;
        else db.clients.push(data.project);
        try{localStorage.setItem(CACHE_KEY,JSON.stringify(db));}catch(_){}
      }
      return data;
    }catch(e){
      console.warn("saveProjectChecklist atomic failed:",e);

      // Если action не поддерживается старым backend — сохраняем через saveState.
      if(isUnknownActionError(e)){
        if(!db || typeof db!=="object") throw new Error("Локальная база не загружена");
        db.clients=Array.isArray(db.clients)?db.clients:[];
        const idx=db.clients.findIndex(x=>String(x.id)===String(projectId));
        if(idx<0) throw new Error("Проект не найден в локальной базе");

        db.clients[idx].theses=JSON.parse(JSON.stringify(Array.isArray(theses)?theses:[]));
        db.clients[idx].blockChecks=JSON.parse(JSON.stringify(Array.isArray(blocks)?blocks:[]));

        const ok=await syncRemote(false);
        if(!ok) throw new Error("Не удалось сохранить проект на сервере");
        return {ok:true,project:db.clients[idx]};
      }

      // При временном сетевом/серверном сбое пробуем один раз подтянуть свежую базу
      // и повторить атомарное сохранение, не используя потенциально повреждённый state.
      try{
        const fresh=await api("getState");
        if(fresh?.state && Array.isArray(fresh.state.clients)){
          db=fresh.state;
          try{localStorage.setItem(CACHE_KEY,JSON.stringify(db));}catch(_){}
        }
        const retry=await api("saveProjectChecklist",payload);
        if(!retry || retry.ok===false) throw new Error(retry?.error||"Повторное сохранение не подтверждено");
        if(retry.project){
          db.clients=Array.isArray(db.clients)?db.clients:[];
          const idx=db.clients.findIndex(x=>String(x.id)===String(projectId));
          if(idx>=0) db.clients[idx]=retry.project; else db.clients.push(retry.project);
          try{localStorage.setItem(CACHE_KEY,JSON.stringify(db));}catch(_){}
        }
        return retry;
      }catch(retryError){
        throw new Error(retryError?.message||e?.message||"Не удалось сохранить тезисы и блоки");
      }
    }
  }
  async function saveChecklistAtomic(projectId,type,itemId,done){
    try{
      const data=await api("saveChecklistItem",{projectId,type,itemId,done:!!done});
      if(data.project){
        const idx=(db.clients||[]).findIndex(x=>x.id===projectId);
        if(idx>=0) db.clients[idx]=data.project;
        localStorage.setItem(CACHE_KEY,JSON.stringify(db));
      }
      return true;
    }catch(e){
      console.warn("Atomic checklist save failed, fallback to saveState:",e);
      // Не показываем ошибку пользователю сразу: сохраняем весь актуальный state.
      // Это также обеспечивает совместимость, если Apps Script ещё без нового action.
      return await syncRemote(false);
    }
  }

  function fileToDataUrl(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||""));
      reader.onerror=()=>reject(reader.error||new Error("Не удалось прочитать изображение"));
      reader.readAsDataURL(file);
    });
  }

  async function fetchState(){
    if(!session?.token) return false;
    try{
      const data=await api("getState");
      db=data.state;
      localStorage.setItem(CACHE_KEY,JSON.stringify(db));
      return true;
    }catch(e){
      console.error(e);
      if(String(e.message||"").toLowerCase().includes("сесс")) logout();
      return false;
    }
  }
  let syncQueued=false;
  let syncRenderQueued=false;
  async function syncRemote(renderAfter=false){
    if(!session?.token){
      if(renderAfter) render();
      return false;
    }
    localStorage.setItem(CACHE_KEY,JSON.stringify(db));

    if(syncing){
      syncQueued=true;
      syncRenderQueued=syncRenderQueued||renderAfter;
      return true;
    }

    syncing=true;
    let ok=true;
    try{
      do{
        syncQueued=false;
        const snapshot=JSON.parse(JSON.stringify(db));
        localStorage.setItem(CACHE_KEY,JSON.stringify(snapshot));
        const data=await api("saveState",{state:snapshot});
        // Если во время запроса пользователь успел сделать ещё изменения,
        // не заменяем локальный db более старым ответом сервера.
        if(!syncQueued && data.state) db=data.state;
        localStorage.setItem(CACHE_KEY,JSON.stringify(db));
      }while(syncQueued);
    }catch(e){
      ok=false;
      console.error("Sync error:",e);
    }finally{
      syncing=false;
      const shouldRender=renderAfter||syncRenderQueued;
      syncRenderQueued=false;
      if(shouldRender) render();
    }
    return ok;
  }
  function save(){ syncRemote(true); }


  const app = document.getElementById("app");
  const esc = s => String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const fmtDate = d => d ? new Date(d+"T00:00:00").toLocaleDateString("ru-RU") : "—";
  const daysBetween = d => {
    if(!d) return 0;
    const a = new Date(d+"T00:00:00"), b = new Date();
    return Math.max(0, Math.floor((b-a)/86400000)+1);
  };
  const uid = p => p + Math.random().toString(36).slice(2,10);
  const nowISO = () => new Date().toISOString();

  function projectStages(c){
    if(!c) return ["Начальная","Развитие","Слияние","Залив. инф","Пред. предлог","72 часа"];
    const cfg=managerConfig(c.managerId);
    const stages=Array.isArray(cfg.funnelStages)&&cfg.funnelStages.length
      ? cfg.funnelStages
      : ["Начальная","Развитие","Слияние","Залив. инф","Пред. предлог","72 часа"];
    return stages;
  }

  function stageMilestonePercent(c, stageIndex){
    const n=Math.max(1,projectStages(c).length);
    if(n<=1) return 0;
    return Math.round((Math.max(0,Math.min(stageIndex,n-1))/(n-1))*100);
  }

  function managerConfig(managerId){
    db.managerConfigs=db.managerConfigs&&typeof db.managerConfigs==="object"?db.managerConfigs:{};
    if(!db.managerConfigs[managerId]){
      db.managerConfigs[managerId]={
        notebook:"",notebookUpdatedAt:"",
        inbox:{
          admin:{id:"",text:"",sentAt:"",readAt:""},
          observer:{id:"",text:"",sentAt:"",readAt:""}
        },
        progressScaleTitle:"Шкала прогресса",
        funnelStages:["Начальная","Развитие","Слияние","Залив. инф","Пред. предлог","72 часа"],
        thesisTemplates:[],blockTemplates:[],statisticsRows:[]
      };
    }
    const cfg=db.managerConfigs[managerId];
    cfg.notebook=String(cfg.notebook||"");
    cfg.notebookUpdatedAt=String(cfg.notebookUpdatedAt||"");
    cfg.progressScaleTitle=String(cfg.progressScaleTitle||"Шкала прогресса");
    cfg.funnelStages=Array.isArray(cfg.funnelStages)&&cfg.funnelStages.length
      ? cfg.funnelStages.map(x=>String(x||"").trim()).filter(Boolean)
      : ["Начальная","Развитие","Слияние","Залив. инф","Пред. предлог","72 часа"];

    // Миграция со старого поля messages -> новый двойной inbox.
    cfg.inbox=cfg.inbox&&typeof cfg.inbox==="object"?cfg.inbox:{};
    const legacy=Array.isArray(cfg.messages)?cfg.messages:["",""];
    ["admin","observer"].forEach((key,idx)=>{
      const old=cfg.inbox[key]&&typeof cfg.inbox[key]==="object"?cfg.inbox[key]:{};
      cfg.inbox[key]={
        id:String(old.id||""),
        text:String(old.text||legacy[idx]||""),
        sentAt:String(old.sentAt||((idx===0&&cfg.lastMessageAt)?cfg.lastMessageAt:"")),
        readAt:String(old.readAt||"")
      };
    });
    cfg.thesisTemplates=Array.isArray(cfg.thesisTemplates)?cfg.thesisTemplates:[];
    cfg.blockTemplates=Array.isArray(cfg.blockTemplates)?cfg.blockTemplates:[];
    cfg.markers=Array.isArray(cfg.markers)?cfg.markers.map(x=>String(x||"").trim()).filter(Boolean):[];
    cfg.statisticsRows=Array.isArray(cfg.statisticsRows)?cfg.statisticsRows:[];
    return cfg;
  }

  function projectTheses(c){
    c.theses=Array.isArray(c.theses)?c.theses:[];
    return c.theses;
  }

  function projectBlocks(c){
    c.blockChecks=Array.isArray(c.blockChecks)?c.blockChecks:[];
    return c.blockChecks;
  }

  function syncProjectTemplates(c){
    const cfg=managerConfig(c.managerId);
    let changed=false;

    cfg.thesisTemplates.forEach(tpl=>{
      let row=projectTheses(c).find(x=>x.templateId===tpl.id);
      if(!row){
        projectTheses(c).push({
          id:uid("th_"),templateId:tpl.id,stageIndex:0,
          text:tpl.text||"",done:false,createdAt:nowISO(),updatedAt:nowISO(),
          authorId:"template",authorName:"Шаблон"
        });
        changed=true;
      }else{
        if(row.text!==tpl.text || Number(row.stageIndex)!==0){ row.text=tpl.text||""; row.stageIndex=0;
          changed=true;
        }
      }
    });

    cfg.blockTemplates.forEach(tpl=>{
      let row=projectBlocks(c).find(x=>x.templateId===tpl.id);
      if(!row){
        projectBlocks(c).push({
          id:uid("bc_"),templateId:tpl.id,stageIndex:0,
          text:tpl.text||"",done:false,createdAt:nowISO(),updatedAt:nowISO()
        });
        changed=true;
      }else{
        if(row.text!==tpl.text || Number(row.stageIndex)!==0){ row.text=tpl.text||""; row.stageIndex=0;
          changed=true;
        }
      }
    });
    return changed;
  }

  function syncManagerTemplates(managerId){
    const cfg=managerConfig(managerId);
    const thesisIds=new Set(cfg.thesisTemplates.map(x=>x.id));
    const blockIds=new Set(cfg.blockTemplates.map(x=>x.id));
    (db.clients||[]).filter(c=>c.managerId===managerId).forEach(c=>{
      c.theses=projectTheses(c).filter(x=>!x.templateId || thesisIds.has(x.templateId));
      c.blockChecks=projectBlocks(c).filter(x=>!x.templateId || blockIds.has(x.templateId));
      syncProjectTemplates(c);
    });
  }

  function globalThesisStats(c){
    const rows=projectTheses(c);
    return {total:rows.length,done:rows.filter(t=>t.done!==false).length};
  }

  function globalBlockStats(c){
    const rows=projectBlocks(c);
    return {total:rows.length,done:rows.filter(t=>t.done!==false).length};
  }

  function globalChecklistStats(c){
    const t=globalThesisStats(c), b=globalBlockStats(c);
    return {total:t.total+b.total,done:t.done+b.done,theses:t,blocks:b};
  }

  function checklistItemPercent(c){
    const stats=globalChecklistStats(c);
    return stats.total ? 100/stats.total : 0;
  }

  function projectProgress(c){
    syncProjectTemplates(c);
    const stats=globalChecklistStats(c);
    if(!stats.total) return 0;
    return Math.round((stats.done/stats.total)*1000)/10;
  }

  function derivedStageIndex(c){
    const n=Math.max(1,projectStages(c).length);
    const p=projectProgress(c);
    if(n<=1) return 0;
    return Math.max(0,Math.min(n-1,Math.floor((p/100)*n)));
  }

  function inboxUnread(msg){
    if(!msg || !msg.text || !msg.sentAt) return 0;
    if(!msg.readAt) return 1;
    return new Date(msg.readAt).getTime() < new Date(msg.sentAt).getTime() ? 1 : 0;
  }

  function inboxTitle(kind){
    return kind==="admin" ? "Административные правки" : "От наблюдателя";
  }

  function geoLabel(c){
    const type=c.geoType||"";
    if(type==="russia") return `🇷🇺 Классика${c.region?` · ${esc(c.region)}`:""}`;
    if(type==="belarus") return "🇧🇾 Усы";
    if(type==="europe") return "🌈 Радуга";
    if(type==="other") return `📍 Иное${c.region?` · ${esc(c.region)}`:""}`;
    return "📍 Не указано";
  }

  function pipeline(c,mode="detail"){
    const stages=projectStages(c);
    const n=stages.length;
    const idx=derivedStageIndex(c);
    const overall=projectProgress(c);
    const pct=overall*0.94;
    const longest=stages.reduce((m,s)=>Math.max(m,String(s||"").length),0);
    const stageMin=Math.max(110,Math.min(190,92+longest*2.4));
    const cardMode=mode==="card";

    return `<div class="pipeline ${cardMode?"pipeline-card-mode":"pipeline-detail-mode"}">
      <div class="progress-summary">
        <div><b>${esc(managerConfig(c.managerId).progressScaleTitle||"Шкала прогресса")}</b><span class="muted small"> Автоматически: отмеченные тезисы + блоки</span></div>
        ${cardMode?`<div class="progress-percent card-progress-percent">${overall}%</div>`:""}
      </div>
      <div class="pipe-track ${cardMode?"":"pipe-track-with-percent"}" style="--count:${n};--progress:${pct}%;--stage-min:${stageMin}px">
        <div class="pipe-progress"></div>
        ${stages.map((s,i)=>`<div class="stage ${i<idx?"done":i===idx?"current":""}">
          <div class="dot"></div>
          <div class="stage-name">${esc(s)}</div>
        </div>`).join("")}
        ${cardMode?"":`<div class="progress-end"><div class="progress-percent">${overall}%</div></div>`}
      </div>
    </div>`;
  }

  function loginView(){
    app.innerHTML = `<div class="login-wrap"><div class="login-card">
      <div class="login-logo"><img class="login-sticker" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KPHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHJ4PSIyNCIgZmlsbD0iIzI1MzI0NiIvPgo8Y2lyY2xlIGN4PSI1MCIgY3k9IjM3IiByPSIxNyIgZmlsbD0iI2Y1OWUwYiIvPgo8cGF0aCBkPSJNMjAgODVjNC0yMCAxNi0zMCAzMC0zMHMyNiAxMCAzMCAzMCIgZmlsbD0iI2Y1OWUwYiIvPgo8L3N2Zz4=" alt="">Цитадель</div>
      <div class="muted" style="margin-bottom:22px">Система управления проектами</div>
      <form id="loginForm">
        <div class="field" style="margin-bottom:12px"><label>Логин</label><input name="login" required autocomplete="username"></div>
        <div class="field" style="margin-bottom:16px"><label>Пароль</label><input type="password" name="password" required autocomplete="current-password"></div>
        <button class="btn primary" style="width:100%">Войти</button>
      </form>
      <div id="loginErr" class="small" style="color:#b91c1c;margin-top:12px"></div>
    </div></div>`;
    document.getElementById("loginForm").onsubmit = async e => {
      e.preventDefault();
      const fd=new FormData(e.target);
      const login=String(fd.get("login")||"").trim();
      const password=String(fd.get("password")||"");
      const err=document.getElementById("loginErr");
      const submit=e.target.querySelector("button");
      if(submit){submit.disabled=true;submit.textContent="Входим...";}
      err.textContent="Подключение к серверу...";
      try{
        const data=await api("login",{login,password});
        if(!data || !data.token) throw new Error(data?.error||"Сервер не вернул токен входа");
        if(data.state && Array.isArray(data.state.users)){
          db=data.state;
        }else{
          const stateData=await api("getState",{token:data.token});
          if(!stateData?.state || !Array.isArray(stateData.state.users)){
            throw new Error("Общая база пользователей не настроена. Обновите Apps Script до версии v24.");
          }
          db=stateData.state;
        }
        const matchedUser =
          (data.user && data.user.id ? data.user : null) ||
          (db.users||[]).find(u=>String(u.login||"").trim().toLowerCase()===login.trim().toLowerCase());

        if(!matchedUser || !matchedUser.id) throw new Error("Пользователь найден, но у него отсутствует ID");
        session={token:data.token,userId:matchedUser.id};
        localStorage.setItem(sessionKey,JSON.stringify(session));
        localStorage.setItem(CACHE_KEY,JSON.stringify(db));
        render();
      }catch(ex){
        err.textContent=ex.message||"Неверный логин или пароль.";
      }finally{
        if(submit){submit.disabled=false;submit.textContent="Войти";}
      }
    };
  }

  function shell(content){
    const me = db.users.find(u=>u.id===session.userId);
    if(!me){logout();return}
    const menu = me.role==="trainee"
      ? [["training","▤","Обучение"]]
      : (me.role==="admin" || me.role==="viewer")
        ? [["dashboard","⌂","Главная"],["managers","◉","Менеджеры"],["allclients","▦","Проекты"],...(me.role==="viewer"?[["trainingAdmin","▤","Обучение"]]:[]),["trash","⌫","Корзина"],...(me.role==="admin"?[["users","♙","Пользователи"]]:[])]
        : [["clients","⌂","Главная"],["clients","▦","Проекты"],["notebook","✎","Блокнот"]];
    const theme = localStorage.getItem("project_theme") || "light";
    document.documentElement.setAttribute("data-theme", theme);
    app.innerHTML = `<div class="app-shell">
      <aside class="sidebar">
        <div class="side-brand"><img class="brand-sticker" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KPHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHJ4PSIyNCIgZmlsbD0iIzI1MzI0NiIvPgo8Y2lyY2xlIGN4PSI1MCIgY3k9IjM3IiByPSIxNyIgZmlsbD0iI2Y1OWUwYiIvPgo8cGF0aCBkPSJNMjAgODVjNC0yMCAxNi0zMCAzMC0zMHMyNiAxMCAzMCAzMCIgZmlsbD0iI2Y1OWUwYiIvPgo8L3N2Zz4=" alt=""><span>Цитадель</span></div>
        <div class="side-user">
          <div class="avatar">${me.avatar?`<img src="${me.avatar}" alt="">`:esc((me.name||"П").charAt(0).toUpperCase())}</div>
          <div><b>${esc(me.name)}</b><span>${roleName(me.role)}</span></div>
        </div>
        <nav class="side-nav">
          ${menu.map(([id,ico,title])=>`<button class="side-link" data-nav="${id}"><span>${ico}</span>${title}</button>`).join("")}
        </nav>
        <div class="side-bottom">
          <button id="themeBtn" class="side-link"><span>${theme==="dark"?"☀":"☾"}</span>${theme==="dark"?"Светлая тема":"Тёмная тема"}</button>
          <button id="logoutBtn" class="side-link"><span>↪</span>Выйти</button>
        </div>
      </aside>
      <section class="content-shell">
        <header class="mobile-top">
          <div class="side-brand"><img class="brand-sticker" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj4KPHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHJ4PSIyNCIgZmlsbD0iIzI1MzI0NiIvPgo8Y2lyY2xlIGN4PSI1MCIgY3k9IjM3IiByPSIxNyIgZmlsbD0iI2Y1OWUwYiIvPgo8cGF0aCBkPSJNMjAgODVjNC0yMCAxNi0zMCAzMC0zMHMyNiAxMCAzMCAzMCIgZmlsbD0iI2Y1OWUwYiIvPgo8L3N2Zz4=" alt=""><span>Цитадель</span></div>
          <div class="mobile-top-actions">
            <button id="mobileTheme" class="btn ghost mobile-icon-btn" aria-label="Тема">${theme==="dark"?"☀":"☾"}</button>
            <button id="mobileLogout" class="btn ghost mobile-logout-btn">Выйти</button>
          </div>
        </header>
        <nav class="mobile-admin-nav">
          ${menu.map(([id,ico,title])=>`<button class="mobile-admin-link" data-nav="${id}"><span class="mobile-admin-ico">${ico}</span><span>${title}</span></button>`).join("")}
        </nav>
        <main class="main">${content}<footer class="footer">© 2026 Цитадель. Все права защищены.</footer></main>
      </section>
    </div>`;
    const toggleTheme=()=>{
      const cur=document.documentElement.getAttribute("data-theme")==="dark"?"dark":"light";
      const next=cur==="dark"?"light":"dark";
      localStorage.setItem("project_theme",next);
      document.documentElement.setAttribute("data-theme",next);
      render();
    };
    document.getElementById("themeBtn").onclick=toggleTheme;
    document.getElementById("mobileTheme").onclick=toggleTheme;
    document.getElementById("logoutBtn").onclick=logout;
    document.getElementById("mobileLogout").onclick=logout;
  }
  function roleName(r){ return r==="admin"?"Администратор":r==="manager"?"Менеджер":r==="trainee"?"Обучение":"Наблюдатель"; }

  function nav(active, me){
    const tabs = me.role==="trainee"
      ? [["training","Моё обучение"]]
      : me.role==="admin"
        ? [["dashboard","Обзор"],["managers","Менеджеры"],["allclients","Все проекты"],["users","Пользователи"]]
        : me.role==="viewer"
          ? [["dashboard","Обзор"],["managers","Менеджеры"],["statistics","Статистика"],["allclients","Все проекты"],["trainingAdmin","Обучение"]]
          : [["clients","Мои проекты"],["notebook","Блокнот"]];
    return `<div class="tabs">${tabs.map(([id,t])=>`<button class="tab ${active===id?"active":""}" data-nav="${id}">${t}</button>`).join("")}</div>`;
  }

  function wireNav(){
    document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>{
      if(b.dataset.nav===currentRoute)return;
      document.querySelectorAll("[data-nav]").forEach(x=>x.classList.toggle("nav-switching",x===b));
      route(b.dataset.nav);
    });
  }

  function projectCard(c, me){
    const manager = db.users.find(u=>u.id===c.managerId);
    const stages=projectStages(c);
    const stage = stages[derivedStageIndex(c)] || "—";
    return `<div class="card client-card" data-project="${c.id}" style="cursor:pointer">
      <div class="client-head">
        <div><div class="client-title">Проект №${String(c.number).padStart(3,"0")} · ${esc(c.name)}</div>
        <div class="meta"><span>В общении: ${daysBetween(c.startDate)} дн.</span><span>Менеджер: ${esc(manager?.name||"—")}</span><span>${c.gender==="male"?"Твёрдый":c.gender==="female"?"Мягкий":"Пол не указан"} · ${geoLabel(c)}</span></div></div>
        <span class="pill orange">${esc(stage)}</span>
      </div>
      ${pipeline(c,"card")}
      ${(me.role==="admin"||me.role==="manager"||me.role==="viewer")?`<div class="card-actions-inline"><button class="btn ghost" data-dialog-export="${c.id}">Последняя выгрузка</button></div>`:""}
    </div>`;
  }

  async function managerView(){
    stopRealtime();

    // v82: страницу рисуем сразу из локального кэша.
    // Синхронизация с сервером идёт в фоне и больше не задерживает переключение вкладок.
    const me = db.users.find(u=>u.id===session.userId);
    if(!me || me.role!=="manager") return render();

    const cfg=managerConfig(me.id);
    syncManagerTemplates(me.id);

    const clients = db.clients.filter(c=>c.managerId===me.id && !c.deleted);
    shell(`${nav("clients",me)}
      <div class="manager-message-bar">
        <button class="boss-message-btn admin-boss-message ${inboxUnread(cfg.inbox.admin)?"admin-message-unread":""}" data-inbox-kind="admin">
          <span class="admin-message-icon">⚠</span>
          <span><b>Административные правки</b><small>Открыть важное сообщение</small></span>
          ${inboxUnread(cfg.inbox.admin)?'<span class="unread-badge admin-unread-badge">1</span>':""}
        </button>
        <button class="boss-message-btn" data-inbox-kind="observer">
          <span>✉ От наблюдателя</span>
          ${inboxUnread(cfg.inbox.observer)?'<span class="unread-badge">1</span>':""}
        </button>
      </div>
      <div class="section-head"><div><h1>Мои проекты</h1><p class="muted">Всего проектов: ${clients.length}</p></div>
      ${me.role==="manager"?'<button id="addClient" class="btn primary">+ Добавить проект</button>':""}</div>
      <div class="toolbar"><input id="q" placeholder="Поиск по имени или номеру"><select id="stageFilter"><option value="">Все стадии</option>${cfg.funnelStages.map((s,i)=>`<option value="${i}">${esc(s)}</option>`).join("")}</select></div>
      <div id="clientList" class="list">${clients.length?clients.map(c=>projectCard(c,me)).join(""):'<div class="empty">Проектов пока нет</div>'}</div>`);
    wireNav();
    if(me.role==="manager") document.getElementById("addClient").onclick=()=>openClientEditor(null);
    const applyManagerConfig=(config)=>{
      if(!config)return;
      db.managerConfigs=db.managerConfigs||{};
      db.managerConfigs[me.id]=config;
      localStorage.setItem(CACHE_KEY,JSON.stringify(db));
    };

    const paintInboxBadges=()=>{
      const liveCfg=managerConfig(me.id);
      document.querySelectorAll("[data-inbox-kind]").forEach(btn=>{
        const kind=btn.dataset.inboxKind;
        const unread=inboxUnread(liveCfg.inbox[kind]);
        let badge=btn.querySelector(".unread-badge");
        if(unread && !badge){
          badge=document.createElement("span");
          badge.className="unread-badge";
          badge.textContent="1";
          btn.appendChild(badge);
        }else if(!unread && badge){
          badge.remove();
        }
      });
    };

    const managerSettingsSignature=()=>{
      const live=managerConfig(me.id);
      return JSON.stringify({
        funnelStages:live.funnelStages||[],
        progressScaleTitle:live.progressScaleTitle||"",
        thesisTemplates:(live.thesisTemplates||[]).map(x=>[x.id,x.text]),
        blockTemplates:(live.blockTemplates||[]).map(x=>[x.id,x.text]),
        markers:(live.markers||[]).map(String)
      });
    };

    let lastManagerSettingsSignature=managerSettingsSignature();

    const refreshManagerData=async()=>{
      try{
        const before=lastManagerSettingsSignature;
        const ok=await fetchState();
        if(!ok)return;

        const freshMe=db.users.find(u=>u.id===session.userId);
        if(!freshMe || freshMe.role!=="manager") return render();

        syncManagerTemplates(freshMe.id);
        const after=managerSettingsSignature();

        // Если Наблюдатель поменял стадии/шкалу/тезисы/блоки,
        // сразу полностью перерисовываем страницу менеджера.
        if(after!==before){
          lastManagerSettingsSignature=after;
          return managerView();
        }

        lastManagerSettingsSignature=after;
        paintInboxBadges();
      }catch(e){ console.warn("manager refresh",e); }
    };

    document.querySelectorAll("[data-inbox-kind]").forEach(btn=>btn.onclick=async()=>{
      const kind=btn.dataset.inboxKind;
      btn.disabled=true;
      try{
        const data=await getManagerDataCompat(me.id);
        applyManagerConfig(data.config);
        const cfgNow=managerConfig(me.id);
        const msg=cfgNow.inbox[kind]||{id:"",text:"",sentAt:"",readAt:""};
        const text=String(msg.text||"").trim()||"Новых сообщений нет.";
        const when=msg.sentAt?new Date(msg.sentAt).toLocaleString("ru-RU"):"";

        if(msg.id && msg.text && inboxUnread(msg)){
          const readData=await markMessageReadCompat(kind,msg.id);
          applyManagerConfig(readData.config);
        }

        const m=document.createElement("div");m.className="modal";
        m.innerHTML=`<div class="modal-card small-modal sms-modal">
          <div class="modal-head">
            <div><h2>${esc(inboxTitle(kind))}</h2>${when?`<div class="muted small">${esc(when)}</div>`:""}</div>
            <button class="icon-btn" data-close>×</button>
          </div>
          <div class="sms-bubble">${esc(text)}</div>
          <div class="actions"><button class="btn primary" data-close>Прочитано</button></div>
        </div>`;
        document.body.appendChild(m);
        m.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>{m.remove();paintInboxBadges();});
      }catch(e){
        alert("Не удалось получить сообщение. Проверьте соединение и повторите.");
      }finally{
        btn.disabled=false;
      }
    });

    setTimeout(refreshManagerData,350);
    realtimeTimer=setInterval(refreshManagerData,15000);
    wireProjectCards();
    const q=document.getElementById("q"), sf=document.getElementById("stageFilter");
    const filt=()=> {
      const term=q.value.toLowerCase().trim(), st=sf.value;
      const f=clients.filter(c=>(!term || c.name.toLowerCase().includes(term)||String(c.number).includes(term)) && (st===""||String(derivedStageIndex(c))===st));
      document.getElementById("clientList").innerHTML=f.length?f.map(c=>projectCard(c,me)).join(""):'<div class="empty">Ничего не найдено</div>';
      wireProjectCards();
    };
    q.oninput=filt; sf.onchange=filt;
  }

  let notebookFileHandle=null;
  let notebookSaveTimer=null;

  async function writeNotebookFile(text){
    if(!notebookFileHandle) return;
    try{
      const writable=await notebookFileHandle.createWritable();
      await writable.write(text);
      await writable.close();
    }catch(e){ console.warn("TXT autosave:",e); }
  }

  function downloadTxt(name,text){
    const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=name;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  }

  async function notebookView(){
    stopRealtime();
    const me=db.users.find(u=>u.id===session.userId);
    if(!me || me.role!=="manager") return managerView();

    const draftKey=`citadel_notebook_draft_${me.id}`;

    // v82: не ждём сервер перед открытием блокнота.
    // Сначала показываем локально сохранённый текст и маркеры.
    const cfg=managerConfig(me.id);
    let startText=cfg.notebook||"";
    try{
      const draft=JSON.parse(localStorage.getItem(draftKey)||"null");
      if(draft && draft.text!=null){
        const draftTs=Date.parse(draft.ts||"")||0;
        const serverTs=Date.parse(cfg.notebookUpdatedAt||"")||0;
        if(draftTs>serverTs) startText=String(draft.text);
      }
    }catch(e){}

    shell(`${nav("notebook",me)}
      <div class="section-head"><div><h1>Мой блокнот</h1><p class="muted">Хранится в общей базе Цитадели и остаётся после выхода и повторного входа.</p></div></div>
      <div class="card notebook-card">
        <div class="notebook-tools">
          <button class="btn primary" id="saveNotebookNow">Сохранить сейчас</button>
          <button class="btn ghost" id="downloadTxt">Скачать TXT</button>
          <button class="btn ghost marker-toggle-btn" id="toggleMarkers">Маркеры</button>
          <span class="muted small" id="notebookStatus">${cfg.notebookUpdatedAt?`Последнее сохранение: ${new Date(cfg.notebookUpdatedAt).toLocaleString("ru-RU")}`:"Сохранено"}</span>
        </div>
        <div class="notebook-marker-panel" id="notebookMarkerPanel" hidden>
          <div class="notebook-marker-title">Маркеры наблюдателя</div>
          <div class="notebook-marker-list">${(cfg.markers||[]).length?(cfg.markers||[]).map((m,i)=>`<button class="notebook-marker-chip" type="button" data-notebook-marker="${i}">${esc(m)}</button>`).join(""):'<span class="muted small">Наблюдатель ещё не добавил маркеры.</span>'}</div>
        </div>
        <textarea id="managerNotebook" class="notebook-textarea" placeholder="Личные рабочие заметки...">${esc(startText)}</textarea>
      </div>`);
    wireNav();

    const ta=document.getElementById("managerNotebook");
    const status=document.getElementById("notebookStatus");
    const saveBtn=document.getElementById("saveNotebookNow");
    const markerToggle=document.getElementById("toggleMarkers");
    const markerPanel=document.getElementById("notebookMarkerPanel");
    if(markerToggle && markerPanel){
      markerToggle.onclick=()=>{
        markerPanel.hidden=!markerPanel.hidden;
        markerToggle.classList.toggle("active",!markerPanel.hidden);
      };
      markerPanel.querySelectorAll("[data-notebook-marker]").forEach(btn=>btn.onclick=()=>{
        const marker=(cfg.markers||[])[Number(btn.dataset.notebookMarker)]||"";
        if(!marker)return;
        const start=ta.selectionStart??ta.value.length;
        const end=ta.selectionEnd??start;
        const prefix=(start>0 && !ta.value.slice(0,start).endsWith("\n"))?"\n":"";
        const insert=`${prefix}[${marker}] `;
        ta.value=ta.value.slice(0,start)+insert+ta.value.slice(end);
        ta.focus();
        const pos=start+insert.length;
        ta.setSelectionRange(pos,pos);
        ta.dispatchEvent(new Event("input",{bubbles:true}));
      });
    }
    let saving=false,saveAgain=false;

    const persistNotebook=async()=>{
      if(saving){saveAgain=true;return true;}
      saving=true;
      const text=ta.value;
      const clientTs=nowISO();
      localStorage.setItem(draftKey,JSON.stringify({text,ts:clientTs}));
      status.textContent="Сохраняю...";
      saveBtn.disabled=true;
      let ok=false;
      try{
        const data=await saveNotebookCompat(text,clientTs);
        if(data.config){
          db.managerConfigs=db.managerConfigs||{};
          db.managerConfigs[me.id]=data.config;
          localStorage.setItem(CACHE_KEY,JSON.stringify(db));
          localStorage.setItem(draftKey,JSON.stringify({
            text:data.config.notebook||"",
            ts:data.config.notebookUpdatedAt||clientTs
          }));
        }
        ok=true;
        status.textContent=`Сохранено: ${new Date(data.config?.notebookUpdatedAt||clientTs).toLocaleString("ru-RU")}`;
      }catch(e){
        status.textContent="Ошибка сохранения — текст оставлен локально";
        console.error(e);
      }finally{
        saving=false;
        saveBtn.disabled=false;
      }
      if(saveAgain){saveAgain=false;return persistNotebook();}
      return ok;
    };

    ta.oninput=()=>{
      const ts=nowISO();
      localStorage.setItem(draftKey,JSON.stringify({text:ta.value,ts}));
      status.textContent="Сохраняю изменения...";
      clearTimeout(notebookSaveTimer);
      notebookSaveTimer=setTimeout(()=>persistNotebook(),450);
    };
    ta.onblur=()=>persistNotebook();
    saveBtn.onclick=()=>persistNotebook();
    document.getElementById("downloadTxt").onclick=()=>downloadTxt(`Цитадель_${me.name}_блокнот.txt`,ta.value);

    // Если локальный черновик был свежее сервера — сразу отправляем его в систему.
    if(startText!==String(cfg.notebook||"")) persistNotebook();

    // Фоновое обновление: не блокирует открытие страницы и не стирает ввод пользователя.
    setTimeout(async()=>{
      try{
        const beforeText=ta.value;
        const hadFocus=document.activeElement===ta;
        const data=await getManagerDataCompat(me.id);
        if(!data?.config)return;
        db.managerConfigs=db.managerConfigs||{};
        db.managerConfigs[me.id]=data.config;
        localStorage.setItem(CACHE_KEY,JSON.stringify(db));

        const fresh=data.config;
        const localDraft=JSON.parse(localStorage.getItem(draftKey)||"null");
        const draftTs=Date.parse(localDraft?.ts||"")||0;
        const serverTs=Date.parse(fresh.notebookUpdatedAt||"")||0;

        // Обновляем текст только если пользователь ещё ничего не менял и сервер новее.
        if(!hadFocus && ta.value===beforeText && serverTs>draftTs && String(fresh.notebook||"")!==ta.value){
          ta.value=String(fresh.notebook||"");
          localStorage.setItem(draftKey,JSON.stringify({text:ta.value,ts:fresh.notebookUpdatedAt||nowISO()}));
          status.textContent=`Обновлено: ${new Date(fresh.notebookUpdatedAt||nowISO()).toLocaleString("ru-RU")}`;
        }
      }catch(e){ console.warn("notebook background refresh",e); }
    },300);
  }

  function adminDashboard(){
    const me = db.users.find(u=>u.id===session.userId);
    const managers=db.users.filter(u=>u.role==="manager");
    const liveProjects=db.clients.filter(c=>!c.deleted);
    const active=liveProjects.filter(c=>derivedStageIndex(c)<projectStages(c).length-1).length;
    shell(`${nav("dashboard",me)}
      <div class="section-head"><div><h1>Обзор</h1><p class="muted">Общая картина по команде</p></div></div>
      <div class="stats">
        <div class="stat"><span class="muted">Менеджеры</span><b>${managers.length}</b></div>
        <div class="stat"><span class="muted">Все проекты</span><b>${liveProjects.length}</b></div>
        <div class="stat"><span class="muted">В работе</span><b>${active}</b></div>
        <div class="stat"><span class="muted">Завершено</span><b>${liveProjects.length-active}</b></div>
      </div>`);
    wireNav();
  }

  function openManagerConfig(mid){
    const me=db.users.find(u=>u.id===session.userId);
    if(!me || !["admin","viewer"].includes(me.role)) return;
    const canManageBlocks=me.role==="viewer";
    const canManageThesesAndBlocks=me.role==="viewer";
    const manager=db.users.find(u=>u.id===mid);
    if(!manager) return;
    const cfg=managerConfig(mid);
    const modal=document.createElement("div");modal.className="modal";
    modal.innerHTML=`<div class="modal-card">
      <div class="modal-head"><div><h2>Настройки менеджера · ${esc(manager.name)}</h2><div class="muted small">Основные тезисы настраиваются здесь. Создавать и удалять блоки может только наблюдатель.</div></div><button class="icon-btn" data-close>×</button></div>
      <div class="card config-panel admin-message-panel">
        <h3>${me.role==="admin"?"Сообщение от главного админа":"Сообщение от наблюдателя"}</h3>
        <div class="muted small">Сообщение приходит менеджеру как отдельное внутреннее СМС и отмечается непрочитанным.</div>
        <textarea id="bossMsg1" placeholder="Введите сообщение менеджеру...">${esc((me.role==="admin"?cfg.inbox.admin:cfg.inbox.observer).text||"")}</textarea>
        <div class="actions" style="margin-top:10px">
          <button class="btn primary" id="sendBossMessage">Отправить СМС</button>
          ${me.role==="admin" && cfg.inbox.admin?.text?'<button class="btn danger" id="deleteBossMessage">Удалить сообщение</button>':""}
        </div>
      </div>

      ${canManageThesesAndBlocks?`
      <div class="card config-panel" style="margin-top:14px">
        <div class="stage-settings-heading">
          <h3>Стадии проекта</h3>
          <button class="btn manager-account-toggle" id="managerAccountToggle" type="button">Настройки менеджера</button>
        </div>
        <div class="manager-account-inline" id="managerAccountInline" hidden>
          <div class="manager-account-title">Настройки менеджера</div>
          <div class="manager-account-grid">
            <label>Имя
              <input id="managerAccountName" value="${esc(manager.name||"")}" placeholder="Имя менеджера">
            </label>
            <label>Логин
              <input id="managerAccountLogin" value="${esc(manager.login||"")}" autocomplete="off" placeholder="Логин">
            </label>
            <label>Новый пароль
              <input id="managerAccountPassword" type="password" autocomplete="new-password" placeholder="Оставьте пустым, если не меняете">
            </label>
            <label>Картинка менеджера
              <input id="managerAvatarFile" type="file" accept="image/*">
            </label>
          </div>
          <div class="manager-account-actions">
            <div class="avatar manager-avatar account-avatar-preview" id="managerAvatarPreview">${manager.avatar?`<img src="${manager.avatar}" alt="">`:esc((manager.name||"М").charAt(0).toUpperCase())}</div>
            <button class="btn" id="removeManagerAvatar" type="button">Убрать картинку</button>
            <button class="btn primary" id="saveManagerAccount" type="button">Сохранить изменения</button>
          </div>
          <div class="muted small">Логин должен быть уникальным. Новый пароль вводится только если его нужно изменить.</div>
        </div>
        <div class="muted small">Только наблюдатель задаёт стадии один раз для этого менеджера. Они применяются ко всем его проектам.</div>
        <label class="small" style="display:block;margin:12px 0 6px">Стадии проекта (через запятую)</label>
        <input id="managerStagesCsv" value="${esc(cfg.funnelStages.join(", "))}" placeholder="Начальная, Развитие, Слияние, Залив. инф, Пред. предлог, 72 часа">
        <div class="small muted" style="margin-top:6px">Например: Начальная, Развитие, Слияние, Залив. инф, Пред. предлог, 72 часа</div>
      </div>

      <div class="card config-panel" style="margin-top:14px">
        <h3>Название шкалы прогресса</h3>
        <div class="muted small">Задаётся один раз для менеджера и автоматически используется во всех его проектах.</div>
        <input id="progressScaleTitle" value="${esc(cfg.progressScaleTitle||"Шкала прогресса")}" placeholder="Например: Шкала контакта">
      </div>

      <div class="card config-panel" style="margin-top:14px">
        <h3>Основные тезисы менеджера</h3><div class="muted small">Добавляются один раз и автоматически одинаковые во всех проектах этого менеджера.</div>
        <div id="managerThesisTemplates" class="template-list"></div>
        <div class="template-add-row">
          <input id="newThesisTemplate" placeholder="Название тезиса">
          <button class="btn primary" id="addThesisTemplate">+ Добавить</button>
        </div>
      </div>

      <div class="card config-panel" style="margin-top:14px">
        <h3>Основные блоки менеджера</h3><div class="muted small">Добавляются один раз и автоматически одинаковые во всех проектах этого менеджера.</div>
        <div class="muted small">Создавать и удалять блоки может только наблюдатель.</div>
        <div id="managerBlockTemplates" class="template-list"></div>
        <div class="template-add-row">
          <input id="newBlockTemplate" placeholder="Название блока">
          <button class="btn primary" id="addBlockTemplate">+ Добавить блок</button>
        </div>
      </div>

      <div class="card config-panel" style="margin-top:14px">
        <h3>Маркеры для блокнота</h3>
        <div class="muted small">Наблюдатель задаёт список маркеров. Менеджер увидит их в блокноте по кнопке «Маркеры».</div>
        <div id="managerMarkers" class="template-list"></div>
        <div class="template-add-row">
          <input id="newManagerMarker" placeholder="Например: Срочно / Возражение / Семья">
          <button class="btn primary" id="addManagerMarker">+ Добавить маркер</button>
        </div>
      </div>`:""}

      <div class="actions">${canManageThesesAndBlocks?'<button class="btn primary" id="saveManagerConfig">Сохранить настройки менеджера</button>':""}<button class="btn ghost" data-close>Закрыть</button></div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>modal.remove());

    const renderTpl=()=>{
      const tbox=modal.querySelector("#managerThesisTemplates");
      const bbox=modal.querySelector("#managerBlockTemplates");
      const mbox=modal.querySelector("#managerMarkers");
      if(!tbox || !bbox) return;
      cfg.markers=Array.isArray(cfg.markers)?cfg.markers:[];
      tbox.innerHTML=cfg.thesisTemplates.length?cfg.thesisTemplates.map(t=>`<div class="template-row"><span>${esc(t.text)}</span><button class="template-del" data-del-thesis="${t.id}">×</button></div>`).join(""):'<div class="muted small">Тезисов пока нет</div>';
      bbox.innerHTML=cfg.blockTemplates.length?cfg.blockTemplates.map(t=>`<div class="template-row"><span>${esc(t.text)}</span>${canManageBlocks?`<button class="template-del" data-del-block="${t.id}">×</button>`:""}</div>`).join(""):'<div class="muted small">Блоков пока нет</div>';
      if(mbox) mbox.innerHTML=cfg.markers.length?cfg.markers.map((t,i)=>`<div class="template-row"><span>${esc(t)}</span><button class="template-del" data-del-marker="${i}">×</button></div>`).join(""):'<div class="muted small">Маркеров пока нет</div>';
      tbox.querySelectorAll("[data-del-thesis]").forEach(b=>b.onclick=()=>{cfg.thesisTemplates=cfg.thesisTemplates.filter(x=>x.id!==b.dataset.delThesis);renderTpl();});
      if(canManageBlocks) bbox.querySelectorAll("[data-del-block]").forEach(b=>b.onclick=()=>{cfg.blockTemplates=cfg.blockTemplates.filter(x=>x.id!==b.dataset.delBlock);renderTpl();});
      if(mbox) mbox.querySelectorAll("[data-del-marker]").forEach(b=>b.onclick=()=>{cfg.markers.splice(Number(b.dataset.delMarker),1);renderTpl();});
    };
    renderTpl();

    const addThesisTemplateBtn=modal.querySelector("#addThesisTemplate");
    if(addThesisTemplateBtn && canManageThesesAndBlocks) addThesisTemplateBtn.onclick=()=>{
      const inp=modal.querySelector("#newThesisTemplate"), text=inp.value.trim();
      if(!text)return;
      cfg.thesisTemplates.push({id:uid("tt_"),stageIndex:0,text});
      inp.value="";renderTpl();
    };
    const addBlockTemplateBtn=modal.querySelector("#addBlockTemplate");
    if(addBlockTemplateBtn && canManageBlocks) addBlockTemplateBtn.onclick=()=>{
      const inp=modal.querySelector("#newBlockTemplate"), text=inp.value.trim();
      if(!text)return;
      cfg.blockTemplates.push({id:uid("bt_"),stageIndex:0,text});
      inp.value="";renderTpl();
    };
    const addManagerMarkerBtn=modal.querySelector("#addManagerMarker");
    if(addManagerMarkerBtn && canManageThesesAndBlocks) addManagerMarkerBtn.onclick=()=>{
      const inp=modal.querySelector("#newManagerMarker"), text=(inp?.value||"").trim();
      if(!text)return;
      cfg.markers=Array.isArray(cfg.markers)?cfg.markers:[];
      if(!cfg.markers.includes(text))cfg.markers.push(text);
      if(inp)inp.value="";
      renderTpl();
    };
    const deleteBossMessage=modal.querySelector("#deleteBossMessage");
    if(deleteBossMessage && me.role==="admin"){
      deleteBossMessage.onclick=async()=>{
        if(!confirm("Удалить сообщение из блока «Административные правки» у этого менеджера?"))return;
        deleteBossMessage.disabled=true;
        try{
          const data=await clearAdminManagerMessageAtomic(mid);
          if(data?.config){
            db.managerConfigs=db.managerConfigs||{};
            db.managerConfigs[mid]=data.config;
          }
          const ta=modal.querySelector("#bossMsg1");
          if(ta)ta.value="";
          deleteBossMessage.remove();
        }catch(e){
          deleteBossMessage.disabled=false;
          alert("Не удалось удалить сообщение: "+(e.message||e));
        }
      };
    }

    const sendBossMessage=modal.querySelector("#sendBossMessage");
    if(sendBossMessage) sendBossMessage.onclick=async()=>{
      const text=modal.querySelector("#bossMsg1").value.trim();
      if(!text){alert("Введите сообщение");return}
      sendBossMessage.disabled=true;
      sendBossMessage.textContent="Отправляю...";
      try{
        const data=await sendMessageCompat(mid,text);
        if(data.config){
          db.managerConfigs=db.managerConfigs||{};
          db.managerConfigs[mid]=data.config;
          localStorage.setItem(CACHE_KEY,JSON.stringify(db));
        }
        sendBossMessage.textContent="СМС отправлено";
        setTimeout(()=>sendBossMessage.textContent="Отправить СМС",1300);
      }catch(e){
        sendBossMessage.textContent="Ошибка";
        alert("Сообщение не отправилось: "+(e.message||e));
      }finally{
        sendBossMessage.disabled=false;
      }
    };


    
    const managerAccountToggle=modal.querySelector("#managerAccountToggle");
    const managerAccountInline=modal.querySelector("#managerAccountInline");
    if(managerAccountToggle && managerAccountInline){
      managerAccountToggle.onclick=()=>{
        managerAccountInline.hidden=!managerAccountInline.hidden;
        managerAccountToggle.textContent=managerAccountInline.hidden?"Настройки менеджера":"Скрыть настройки";
      };
    }

    let pendingManagerAvatar=manager.avatar||"";
    const managerAvatarFile=modal.querySelector("#managerAvatarFile");
    const managerAvatarPreview=modal.querySelector("#managerAvatarPreview");
    const removeManagerAvatar=modal.querySelector("#removeManagerAvatar");
    const saveManagerAccount=modal.querySelector("#saveManagerAccount");

    if(managerAvatarFile) managerAvatarFile.onchange=async()=>{
      const file=managerAvatarFile.files?.[0];
      if(!file)return;
      if(!String(file.type||"").startsWith("image/")){ alert("Выберите изображение"); return; }
      if(file.size>2*1024*1024){ alert("Картинка должна быть не больше 2 МБ"); managerAvatarFile.value=""; return; }
      try{
        pendingManagerAvatar=await fileToDataUrl(file);
        managerAvatarPreview.innerHTML=`<img src="${pendingManagerAvatar}" alt="">`;
      }catch(e){ alert("Не удалось загрузить картинку"); }
    };

    if(removeManagerAvatar) removeManagerAvatar.onclick=()=>{
      pendingManagerAvatar="";
      if(managerAvatarFile) managerAvatarFile.value="";
      if(managerAvatarPreview) managerAvatarPreview.textContent=(manager.name||"М").charAt(0).toUpperCase();
    };

    if(saveManagerAccount) saveManagerAccount.onclick=async()=>{
      const name=(modal.querySelector("#managerAccountName")?.value||"").trim();
      const login=(modal.querySelector("#managerAccountLogin")?.value||"").trim();
      const password=modal.querySelector("#managerAccountPassword")?.value||"";
      if(name.length<2){alert("Имя должно содержать минимум 2 символа");return;}
      if(login.length<3){alert("Логин должен содержать минимум 3 символа");return;}
      if(password && password.length<6){alert("Новый пароль должен содержать минимум 6 символов");return;}

      saveManagerAccount.disabled=true;
      const oldText=saveManagerAccount.textContent;
      saveManagerAccount.textContent="Сохраняю...";
      try{
        const data=await updateManagerAccountAtomic(mid,{name,login,password,avatar:pendingManagerAvatar});
        if(!data || data.ok===false) throw new Error(data?.error||"Сервер не подтвердил сохранение");
        saveManagerAccount.textContent="Сохранено";
        if(modal.querySelector("#managerAccountPassword")) modal.querySelector("#managerAccountPassword").value="";
        setTimeout(()=>{saveManagerAccount.disabled=false;saveManagerAccount.textContent=oldText;},700);
      }catch(e){
        saveManagerAccount.disabled=false;
        saveManagerAccount.textContent=oldText;
        alert("Не удалось сохранить настройки менеджера: "+(e.message||e));
      }
    };

const saveManagerConfigBtn=modal.querySelector("#saveManagerConfig");
    if(saveManagerConfigBtn && canManageThesesAndBlocks) saveManagerConfigBtn.onclick=async()=>{
      const titleInput=modal.querySelector("#progressScaleTitle");
      if(titleInput) cfg.progressScaleTitle=titleInput.value.trim()||"Шкала прогресса";

      const stagesInput=modal.querySelector("#managerStagesCsv");
      if(stagesInput){
        const stages=stagesInput.value.split(",").map(x=>x.trim()).filter(Boolean);
        if(stages.length<1){alert("Укажите хотя бы одну стадию");return}
        cfg.funnelStages=stages;
      }

      // Все тезисы и все блоки сохраняются одним массивом на уровне менеджера.
      cfg.thesisTemplates=(cfg.thesisTemplates||[]).map(x=>({
        id:String(x.id||uid("tt_")),
        stageIndex:0,
        text:String(x.text||"").trim()
      })).filter(x=>x.text);
      cfg.blockTemplates=(cfg.blockTemplates||[]).map(x=>({
        id:String(x.id||uid("bt_")),
        stageIndex:0,
        text:String(x.text||"").trim()
      })).filter(x=>x.text);
      cfg.markers=(cfg.markers||[]).map(x=>String(x||"").trim()).filter(Boolean);

      syncManagerTemplates(mid);
      (db.clients||[]).filter(p=>p.managerId===mid).forEach(p=>{
        delete p.stages;
        p.stageIndex=Math.min(Number(p.stageIndex)||0,Math.max(0,cfg.funnelStages.length-1));
      });

      saveManagerConfigBtn.disabled=true;
      saveManagerConfigBtn.textContent="Сохраняю...";
      try{
        const ok=await saveManagerSettingsAtomic(mid);
        if(!ok) throw new Error("Сервер не подтвердил сохранение");
        saveManagerConfigBtn.textContent="Сохранено";
        setTimeout(()=>{
          modal.remove();
          adminManagerClients(mid);
        },350);
      }catch(e){
        saveManagerConfigBtn.disabled=false;
        saveManagerConfigBtn.textContent="Сохранить настройки менеджера";
        alert("Настройки менеджера не сохранились: "+(e.message||e));
      }
    };
  }

  function observerStatisticsView(){
    const me=(db.users||[]).find(u=>u.id===session.userId);
    if(!me || me.role!=="viewer") return adminDashboard();

    const managers=(db.users||[]).filter(u=>u.role==="manager");
    shell(`${nav("statistics",me)}
      <div class="section-head">
        <div>
          <h1>Статистика</h1>
          <p class="muted">Статистика ведётся отдельно по каждому менеджеру. Данные заполняет наблюдатель.</p>
        </div>
      </div>
      <div class="stats-manager-list">
        ${managers.length?managers.map(m=>{
          const cfg=managerConfig(m.id);
          const rows=Array.isArray(cfg.statisticsRows)?cfg.statisticsRows:[];
          return `<div class="card stats-manager-card">
            <div class="stats-manager-head">
              <div class="manager-profile">
                <div class="avatar manager-avatar">${m.avatar?`<img src="${m.avatar}" alt="">`:esc((m.name||"М").charAt(0).toUpperCase())}</div>
                <div>
                  <div class="manager-name">${esc(m.name||m.login||"Менеджер")}</div>
                  <div class="muted small">${rows.length} строк статистики</div>
                </div>
              </div>
              <button class="btn primary" data-open-manager-stats="${m.id}">Открыть статистику</button>
            </div>
          </div>`;
        }).join(""):'<div class="empty">Менеджеров пока нет</div>'}
      </div>`);
    wireNav();
    document.querySelectorAll("[data-open-manager-stats]").forEach(btn=>{
      btn.onclick=()=>openManagerStatistics(btn.dataset.openManagerStats);
    });
  }

  function openManagerStatistics(managerId){
    const me=(db.users||[]).find(u=>u.id===session.userId);
    if(!me || me.role!=="viewer") return;
    const manager=(db.users||[]).find(u=>u.id===managerId && u.role==="manager");
    if(!manager)return;
    const cfg=managerConfig(managerId);
    cfg.statisticsRows=Array.isArray(cfg.statisticsRows)?cfg.statisticsRows:[];
    let draft=JSON.parse(JSON.stringify(cfg.statisticsRows));

    const modal=document.createElement("div");
    modal.className="modal";
    modal.innerHTML=`<div class="modal-card stats-modal">
      <div class="modal-head">
        <div>
          <h2>Статистика · ${esc(manager.name||manager.login||"Менеджер")}</h2>
          <div class="muted small">Мини-таблицу заполняет и редактирует наблюдатель.</div>
        </div>
        <button class="icon-btn" data-close>×</button>
      </div>

      <div class="stats-table-wrap">
        <table class="stats-mini-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Показатель</th>
              <th>Значение</th>
              <th>Комментарий</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="managerStatsRows"></tbody>
        </table>
      </div>

      <div class="stats-add-bar">
        <button class="btn" id="addStatsRow">+ Добавить строку</button>
        <span class="muted small">Например: дата → звонки → 15 → хороший результат.</span>
      </div>

      <div class="actions">
        <button class="btn primary" id="saveManagerStats">Сохранить статистику</button>
        <button class="btn ghost" data-close>Закрыть</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>modal.remove());

    const tbody=modal.querySelector("#managerStatsRows");
    const renderRows=()=>{
      tbody.innerHTML=draft.length?draft.map((r,i)=>`<tr>
        <td><input type="date" data-stat-date="${i}" value="${esc(r.date||"")}"></td>
        <td><input data-stat-metric="${i}" value="${esc(r.metric||"")}" placeholder="Показатель"></td>
        <td><input data-stat-value="${i}" value="${esc(r.value||"")}" placeholder="Значение"></td>
        <td><input data-stat-comment="${i}" value="${esc(r.comment||"")}" placeholder="Комментарий"></td>
        <td><button class="btn danger small-btn" data-delete-stat="${i}">×</button></td>
      </tr>`).join(""):`<tr><td colspan="5"><div class="empty small">Статистика пока не заполнена</div></td></tr>`;

      draft.forEach((r,i)=>{
        const d=tbody.querySelector(`[data-stat-date="${i}"]`);
        const m=tbody.querySelector(`[data-stat-metric="${i}"]`);
        const v=tbody.querySelector(`[data-stat-value="${i}"]`);
        const c=tbody.querySelector(`[data-stat-comment="${i}"]`);
        if(d)d.oninput=()=>r.date=d.value;
        if(m)m.oninput=()=>r.metric=m.value;
        if(v)v.oninput=()=>r.value=v.value;
        if(c)c.oninput=()=>r.comment=c.value;
      });
      tbody.querySelectorAll("[data-delete-stat]").forEach(btn=>btn.onclick=()=>{
        draft.splice(Number(btn.dataset.deleteStat),1);
        renderRows();
      });
    };
    renderRows();

    modal.querySelector("#addStatsRow").onclick=()=>{
      draft.push({id:uid("stat_"),date:new Date().toISOString().slice(0,10),metric:"",value:"",comment:"",updatedAt:nowISO()});
      renderRows();
      setTimeout(()=>tbody.querySelector(`[data-stat-metric="${draft.length-1}"]`)?.focus(),20);
    };

    modal.querySelector("#saveManagerStats").onclick=async()=>{
      draft=draft.map(r=>({
        id:String(r.id||uid("stat_")),
        date:String(r.date||""),
        metric:String(r.metric||"").trim(),
        value:String(r.value||"").trim(),
        comment:String(r.comment||"").trim(),
        updatedAt:nowISO()
      })).filter(r=>r.date||r.metric||r.value||r.comment);

      const btn=modal.querySelector("#saveManagerStats");
      btn.disabled=true;btn.textContent="Сохраняю...";
      try{
        const data=await saveManagerStatisticsAtomic(managerId,draft);
        if(!data?.ok)throw new Error(data?.error||"Сервер не подтвердил сохранение");
        managerConfig(managerId).statisticsRows=JSON.parse(JSON.stringify(draft));
        btn.textContent="Сохранено ✓";
        setTimeout(()=>{modal.remove();observerStatisticsView();},500);
      }catch(e){
        btn.disabled=false;btn.textContent="Сохранить статистику";
        alert("Не удалось сохранить статистику: "+(e?.message||e));
      }
    };
  }

  function adminManagers(){
    const users=Array.isArray(db?.users)?db.users:[];
    const me=users.find(u=>u.id===session.userId)||users.find(u=>u.role==="admin")||users[0];
    const managers=(db.users||[]).filter(u=>u.role==="manager");

    shell(`${nav("managers",me)}
      <div class="section-head">
        <div>
          <h1>Менеджеры</h1>
          <p class="muted">Нажмите на менеджера, чтобы увидеть его проекты</p>
        </div>
      </div>
      <div class="grid">
        ${managers.map(m=>{
          const cc=(db.clients||[]).filter(c=>c.managerId===m.id && !c.deleted);
          return `<div class="card manager-card" data-manager-card="${m.id}">
            <div class="manager-profile" data-open-manager="${m.id}" style="cursor:pointer">
              <div class="avatar manager-avatar">${m.avatar?`<img src="${m.avatar}" alt="">`:esc((m.name||"М").charAt(0).toUpperCase())}</div>
              <div>
                <div class="manager-name">${esc(m.name)}</div>
                <div class="muted">${cc.length} проектов</div>
              </div>
            </div>
            <div class="actions" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn" data-open-manager="${m.id}">Открыть</button>
              ${me.role==="viewer"?`<button class="btn danger" data-delete-manager="${m.id}">Удалить менеджера</button>`:""}
            </div>
          </div>`;
        }).join("")||'<div class="empty">Менеджеров нет</div>'}
      </div>`);

    wireNav();

    document.querySelectorAll("[data-open-manager]").forEach(el=>{
      el.onclick=(ev)=>{
        ev.preventDefault();
        ev.stopPropagation();
        adminManagerClients(el.dataset.openManager);
      };
    });

    document.querySelectorAll("[data-delete-manager]").forEach(btn=>{
      btn.onclick=async(ev)=>{
        ev.preventDefault();
        ev.stopPropagation();

        const managerId=btn.dataset.deleteManager;
        const manager=(db.users||[]).find(u=>u.id===managerId && u.role==="manager");
        if(!manager)return;

        if(!confirm(`Полностью удалить менеджера «${manager.name}»?\n\nБудут удалены его аккаунт, проекты, настройки, блокнот и сообщения. Действие нельзя отменить.`)) return;

        btn.disabled=true;
        const oldText=btn.textContent;
        btn.textContent="Удаляю...";

        try{
          const data=await api("deleteManager",{managerId});
          if(!data || data.ok===false) throw new Error(data?.error||"Сервер не подтвердил удаление");

          if(data.state){
            db=data.state;
            localStorage.setItem(CACHE_KEY,JSON.stringify(db));
          }else{
            await fetchState();
          }

          adminManagers();
        }catch(e){
          btn.disabled=false;
          btn.textContent=oldText;
          alert("Не удалось удалить менеджера: "+(e.message||e));
        }
      };
    });
  }

  function adminManagerClients(mid){
    const me=db.users.find(u=>u.id===session.userId), m=db.users.find(u=>u.id===mid);
    const clients=db.clients.filter(c=>c.managerId===mid && !c.deleted);
    shell(`${nav("managers",me)}
      <div class="section-head">
        <div><button class="btn ghost" id="backManagers">← Назад</button><h1 style="margin-top:12px">${esc(m?.name||"Менеджер")}</h1><p class="muted">${clients.length} проектов</p></div>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primary" id="managerConfigBtn">${me.role==="viewer"?"Настройки менеджера":"Сообщение менеджеру"}</button>
          ${me.role==="viewer"?'<button class="btn danger" id="deleteManagerFromPage">Удалить менеджера</button>':""}
        </div>
      </div>
      <div class="card manager-notebook-view" style="margin-bottom:14px">
        <div class="manager-notebook-head">
          <div><h3 style="margin:0">Личный блокнот менеджера</h3><div class="muted small">Сохраняется в Цитадели. Виден администратору и наблюдателю.</div></div>
          <div class="notebook-admin-actions"><span class="pill">${esc(m?.name||"")}</span><button class="btn ghost" id="refreshManagerNotebook">Обновить</button></div>
        </div>
        <div class="muted small" id="managerNotebookUpdated">${managerConfig(mid).notebookUpdatedAt?`Обновлён: ${new Date(managerConfig(mid).notebookUpdatedAt).toLocaleString("ru-RU")}`:""}</div>
        <pre class="manager-notebook-content" id="managerNotebookContent">${esc(managerConfig(mid).notebook||"")||"Блокнот пока пуст."}</pre>
      </div>
      <div class="list">${clients.length?clients.map(c=>projectCard(c,me)).join(""):'<div class="empty">Проектов нет</div>'}</div>`);
    wireNav();
    document.getElementById("backManagers").onclick=()=>route("managers");
    document.getElementById("managerConfigBtn").onclick=()=>openManagerConfig(mid);
    const deleteManagerFromPage=document.getElementById("deleteManagerFromPage");
    if(deleteManagerFromPage) deleteManagerFromPage.onclick=async()=>{
      if(!m)return;
      if(!confirm(`Полностью удалить менеджера «${m.name}»?\n\nБудут удалены его аккаунт, проекты, настройки, блокнот и сообщения. Действие нельзя отменить.`)) return;
      deleteManagerFromPage.disabled=true;
      deleteManagerFromPage.textContent="Удаляю...";
      try{
        const data=await api("deleteManager",{managerId:mid});
        if(!data || data.ok===false) throw new Error(data?.error||"Сервер не подтвердил удаление");
        if(data.state){
          db=data.state;
          localStorage.setItem(CACHE_KEY,JSON.stringify(db));
        }else{
          await fetchState();
        }
        adminManagers();
      }catch(e){
        deleteManagerFromPage.disabled=false;
        deleteManagerFromPage.textContent="Удалить менеджера";
        alert("Не удалось удалить менеджера: "+(e.message||e));
      }
    };
    document.getElementById("refreshManagerNotebook").onclick=async()=>{
      const btn=document.getElementById("refreshManagerNotebook");
      btn.disabled=true;btn.textContent="Обновляю...";
      try{
        const data=await getManagerDataCompat(mid);
        if(data.config){
          db.managerConfigs=db.managerConfigs||{};
          db.managerConfigs[mid]=data.config;
          localStorage.setItem(CACHE_KEY,JSON.stringify(db));
          document.getElementById("managerNotebookContent").textContent=data.config.notebook||"Блокнот пока пуст.";
          document.getElementById("managerNotebookUpdated").textContent=data.config.notebookUpdatedAt?`Обновлён: ${new Date(data.config.notebookUpdatedAt).toLocaleString("ru-RU")}`:"";
        }
      }catch(e){ alert("Не удалось обновить блокнот"); }
      btn.disabled=false;btn.textContent="Обновить";
    };
    wireProjectCards();
  }

  function adminAllClients(){
    const users=Array.isArray(db?.users)?db.users:[]; const me=users.find(u=>u.id===session.userId)||users.find(u=>u.role==="admin")||users[0];
    shell(`${nav("allclients",me)}
      <div class="section-head"><div><h1>Все проекты</h1><p class="muted">${db.clients.filter(c=>!c.deleted).length} записей</p></div></div>
      <div class="toolbar"><input id="q" placeholder="Поиск"><select id="mgrFilter"><option value="">Все менеджеры</option>${db.users.filter(u=>u.role==="manager").map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select></div>
      <div id="clientList" class="list">${db.clients.filter(c=>!c.deleted).map(c=>projectCard(c,me)).join("")||'<div class="empty">Проектов нет</div>'}</div>`);
    wireNav(); wireProjectCards();
    const q=document.getElementById("q"), mf=document.getElementById("mgrFilter");
    const filt=()=>{const t=q.value.toLowerCase().trim(),mid=mf.value;const f=db.clients.filter(c=>!c.deleted&&(!t||c.name.toLowerCase().includes(t)||String(c.number).includes(t))&&(!mid||c.managerId===mid));document.getElementById("clientList").innerHTML=f.map(c=>projectCard(c,me)).join("")||'<div class="empty">Ничего не найдено</div>';wireProjectCards();};
    q.oninput=filt;mf.onchange=filt;
  }


  function trashView(){
    const users=Array.isArray(db?.users)?db.users:[]; const me=users.find(u=>u.id===session.userId)||users.find(u=>u.role==="admin")||users[0];
    const deleted=db.clients.filter(c=>c.deleted && (me.role==="admin"||me.role==="viewer"||c.managerId===me.id));
    const card=(c)=>{
      const manager=db.users.find(u=>u.id===c.managerId);
      return `<div class="card client-card trash-project-card" data-project="${c.id}">
        <div class="client-head">
          <div>
            <div class="client-title">Проект №${String(c.number).padStart(3,"0")} · ${esc(c.name)}</div>
            <div class="meta"><span>Менеджер: ${esc(manager?.name||"—")}</span><span>Удалён: ${c.deletedAt?new Date(c.deletedAt).toLocaleString("ru-RU"):"—"}</span></div>
          </div>
          <span class="pill gray">В корзине</span>
        </div>
        <div class="card-actions-inline">
          <button class="btn ghost" data-open-trash-project="${c.id}">Открыть</button>
          ${me.role==="viewer"?`<button class="btn danger" data-delete-project-forever="${c.id}">Удалить полностью</button>`:""}
        </div>
      </div>`;
    };
    shell(`${nav("trash",me)}
      <div class="section-head"><div><h1>Корзина</h1><p class="muted">${me.role==="viewer"?"Наблюдатель может полностью удалять проекты из базы.":"Удалённые проекты доступны только для просмотра."}</p></div></div>
      <div class="list">${deleted.length?deleted.map(card).join(""):'<div class="empty">Корзина пуста</div>'}</div>`);
    wireNav();
    document.querySelectorAll("[data-open-trash-project]").forEach(btn=>btn.onclick=()=>openClient(btn.dataset.openTrashProject));
    document.querySelectorAll("[data-delete-project-forever]").forEach(btn=>btn.onclick=async(e)=>{
      e.stopPropagation();
      const id=btn.dataset.deleteProjectForever;
      const c=db.clients.find(x=>String(x.id)===String(id));
      if(!c)return;
      if(!confirm(`Полностью удалить проект №${String(c.number).padStart(3,"0")} · ${c.name}?\\n\\nОн будет удалён без возможности восстановления.`))return;
      btn.disabled=true;
      btn.textContent="Удаляю...";
      try{
        const data=await deleteProjectForeverAtomic(id);
        if(!data?.ok)throw new Error(data?.error||"Сервер не подтвердил удаление");
        trashView();
      }catch(err){
        btn.disabled=false;
        btn.textContent="Удалить полностью";
        alert("Не удалось полностью удалить проект: "+(err?.message||err));
      }
    });
  }

  function usersView(){
    const users=Array.isArray(db?.users)?db.users:[]; const me=users.find(u=>u.id===session.userId)||users.find(u=>u.role==="admin")||users[0];
    shell(`${nav("users",me)}
      <div class="section-head"><div><h1>Пользователи</h1><p class="muted">Регистрация отключена — аккаунты создаёт администратор. Данные синхронизируются с листом «Пользователи» в Google Таблице.</p></div><button id="addUser" class="btn primary">+ Добавить пользователя</button></div>
      <div class="table-wrap card"><table class="table"><thead><tr><th>Имя</th><th>Логин</th><th>Роль</th><th>Доступ</th><th>ID</th><th></th></tr></thead><tbody>
      ${(db.users||[]).map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.login)}</td><td>${roleName(u.role)}</td><td>${u.active!==false?'<span class="pill green">Разрешён</span>':'<span class="pill gray">Запрещён</span>'}</td><td><span class="small muted">${esc(u.id||"—")}</span></td><td><button class="btn" data-edit-user="${u.id}">Редактировать</button></td></tr>`).join("")}
      </tbody></table></div>`);
    wireNav();
    document.getElementById("addUser").onclick=()=>openUserEditor(null);
    document.querySelectorAll("[data-edit-user]").forEach(b=>b.onclick=()=>openUserEditor(b.dataset.editUser));
  }

  function openUserEditor(id){
    const u=id?db.users.find(x=>x.id===id):null;
    const modal=document.createElement("div");modal.className="modal";
    modal.innerHTML=`<div class="modal-card"><div class="modal-head"><div><h2>${u?"Редактировать":"Новый"} пользователь</h2><div class="muted small">Только администратор может создавать аккаунты</div></div><button class="icon-btn" data-close>×</button></div>
      <form id="userForm" class="form-grid">
        <div class="field"><label>Имя</label><input name="name" required value="${esc(u?.name||"")}"></div>
        <div class="field"><label>Логин</label><input name="login" required value="${esc(u?.login||"")}"></div>
        <div class="field"><label>Пароль</label><input type="password" name="password" ${u?"":"required"} placeholder="${u?"Оставьте пустым, чтобы не менять":"Введите пароль"}"></div>
        <div class="field"><label>Роль</label><select name="role"><option value="manager" ${u?.role==="manager"?"selected":""}>Менеджер</option><option value="viewer" ${u?.role==="viewer"?"selected":""}>Наблюдатель</option><option value="admin" ${u?.role==="admin"?"selected":""}>Администратор</option></select></div>
        <div class="field full">
          <label>Аватар менеджера</label>
          <div class="avatar-editor">
            <div class="avatar avatar-preview" id="avatarPreview">${u?.avatar?`<img src="${u.avatar}" alt="">`:esc((u?.name||"М").charAt(0).toUpperCase())}</div>
            <div class="avatar-controls">
              <input type="file" id="avatarFile" accept="image/*">
              <div class="small muted" style="margin-top:6px">Выбери фотографию менеджера. До 2 МБ.</div>
              ${u?.avatar?'<button type="button" class="btn ghost" id="removeAvatar" style="margin-top:8px">Удалить аватар</button>':""}
            </div>
          </div>
        </div>
        <div class="field"><label>Статус</label><select name="active"><option value="1" ${u?.active!==false?"selected":""}>Активен</option><option value="0" ${u?.active===false?"selected":""}>Заблокирован</option></select></div>
        <div class="actions field full"><button type="button" class="btn ghost" data-close>Отмена</button><button class="btn primary">Сохранить</button></div>
      </form></div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>modal.remove());
    
    const avatarFile=modal.querySelector("#avatarFile");
    const avatarPreview=modal.querySelector("#avatarPreview");
    modal.dataset.avatarData=u?.avatar||"";
    if(avatarFile){
      avatarFile.onchange=()=>{
        const file=avatarFile.files?.[0];
        if(!file)return;
        if(file.size>2*1024*1024){
          alert("Фотография должна быть не больше 2 МБ");
          avatarFile.value="";
          return;
        }
        const reader=new FileReader();
        reader.onload=()=>{
          modal.dataset.avatarData=String(reader.result);
          if(avatarPreview) avatarPreview.innerHTML=`<img src="${reader.result}" alt="">`;
        };
        reader.readAsDataURL(file);
      };
    }
    const removeAvatar=modal.querySelector("#removeAvatar");
    if(removeAvatar){
      removeAvatar.onclick=()=>{
        modal.dataset.avatarData="";
        if(avatarPreview) avatarPreview.textContent=(u?.name||"М").charAt(0).toUpperCase();
        removeAvatar.remove();
      };
    }
    modal.querySelector("#userForm").onsubmit=e=>{
      e.preventDefault();const fd=new FormData(e.target);
      const cleanName=String(fd.get("name")||"").trim();
      const cleanLogin=String(fd.get("login")||"").trim().toLowerCase();
      const cleanPassword=String(fd.get("password")||"");
      if(!cleanName || !cleanLogin || (!u && !cleanPassword)){alert("Заполните имя, логин и пароль");return}
      if(db.users.some(x=>String(x.login||"").trim().toLowerCase()===cleanLogin&&x.id!==id)){alert("Такой логин уже существует");return}
      const data={id:u?.id||uid("u_"),name:cleanName,login:cleanLogin,password:cleanPassword,role:fd.get("role"),nick:fd.get("nick"),avatar:modal.dataset.avatarData||"",active:fd.get("active")==="1"};
      if(u) Object.assign(u,data); else db.users.push(data);
      syncRemote(false);
      alert(data.password?`Пользователь сохранён.\nЛогин: ${data.login}\nПароль: ${data.password}`:`Пользователь сохранён.\nЛогин: ${data.login}\nПароль не изменён.`);
      modal.remove();route("users");
    };
  }

  function wireProjectCards(){
    document.querySelectorAll("[data-project]").forEach(el=>el.onclick=(e)=>{
      if(e.target.closest("[data-dialog-export]")) return;
      openClient(el.dataset.project);
    });
    document.querySelectorAll("[data-dialog-export]").forEach(btn=>btn.onclick=(e)=>{
      e.stopPropagation();
      openDialogExport(btn.dataset.dialogExport);
    });
  }

  function openDialogExport(id){
    const c=db.clients.find(x=>x.id===id);
    const users=Array.isArray(db?.users)?db.users:[]; const me=users.find(u=>u.id===session.userId)||users.find(u=>u.role==="admin")||users[0];
    if(!c || !me) return;
    if(!["admin","viewer","manager"].includes(me.role)){ alert("Нет доступа"); return; }

    c.dialogExport = c.dialogExport || {updatedAt:"",summary:"",details:""};
    const canEdit = me.role==="viewer" && !c.deleted;
    const modal=document.createElement("div");
    modal.className="modal";
    modal.innerHTML=`<div class="modal-card">
      <div class="modal-head">
        <div>
          <h2>Последняя выгрузка диалога</h2>
          <div class="muted">Проект №${String(c.number).padStart(3,"0")} · ${esc(c.name)}</div>
        </div>
        <button class="icon-btn" data-close>×</button>
      </div>

      ${c.deleted?'<div class="notice">Проект находится в корзине. Выгрузка доступна только для просмотра.</div>':""}

      <div class="card export-date-card">
        <b>Последнее обновление</b>
        <div>${c.dialogExport.updatedAt ? new Date(c.dialogExport.updatedAt).toLocaleString("ru-RU") : "Выгрузка ещё не добавлена"}</div>
      </div>

      <div class="field" style="margin-top:14px">
        <label>Краткая информация о выгрузке</label>
        <textarea id="exportSummary" ${canEdit?"":"readonly"} placeholder="Кратко: что было в последнем диалоге, результат, договорённости">${esc(c.dialogExport.summary||"")}</textarea>
      </div>

      <div class="field" style="margin-top:14px">
        <label>Последняя выгрузка диалога</label>
        <textarea id="exportDetails" ${canEdit?"":"readonly"} class="export-text" placeholder="Вставьте сюда текст или информацию из последней выгрузки диалога">${esc(c.dialogExport.details||"")}</textarea>
      </div>

      <div class="actions">
        ${canEdit?'<button class="btn primary" id="saveDialogExport">Сохранить выгрузку</button>':""}
        <button class="btn ghost" data-close>Закрыть</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>modal.remove());
    if(canEdit){
      document.getElementById("saveDialogExport").onclick=()=>{
        c.dialogExport.summary=document.getElementById("exportSummary").value.trim();
        c.dialogExport.details=document.getElementById("exportDetails").value.trim();
        c.dialogExport.updatedAt=nowISO();
        c.history=c.history||[];
        c.history.push({ts:nowISO(),text:"Наблюдатель обновил последнюю выгрузку диалога"});
        syncRemote(false);
        modal.remove(); render();
      };
    }
  }

  function openClient(id){
    const c=db.clients.find(x=>x.id===id), me=db.users.find(u=>u.id===session.userId);
    if(!c)return;
    if(me.role!=="admin" && me.role!=="viewer" && c.managerId!==me.id){alert("Нет доступа");return}
    const manager=db.users.find(u=>u.id===c.managerId);
    const templateChanged=syncProjectTemplates(c);
    if(templateChanged) syncRemote(false);
    const canEdit=!c.deleted && (me.role==="admin"||me.role==="manager");
    const canChecklist=!c.deleted && (me.role==="admin"||me.role==="manager"||me.role==="viewer");
    const canTemplateAdd=!c.deleted && (me.role==="admin"||me.role==="viewer");
    const canDelete=!c.deleted && (me.role==="admin"||me.role==="viewer");
    const canBlockComment=!c.deleted && (me.role==="admin"||me.role==="manager"||me.role==="viewer");
    const modal=document.createElement("div");modal.className="modal";
    modal.innerHTML=`<div class="modal-card project-detail-modal"><div class="modal-head"><div><h2>Проект №${String(c.number).padStart(3,"0")} · ${esc(c.name)}</h2><div class="muted">Менеджер: ${esc(manager?.name||"—")} · В общении ${daysBetween(c.startDate)} дн.</div></div><button class="icon-btn" data-close>×</button></div>
      ${pipeline(c)}

      <div class="card admin-project-comment-card" style="box-shadow:none;margin-top:14px">
        <div class="admin-project-comment-head">
          <div>
            <h3 style="margin:0">📌 Административные правки</h3>
            <div class="muted small">${me.role==="admin"?"Комментарий будет виден менеджеру именно в этом проекте.":"Важная информация от главного администратора по этому проекту."}</div>
          </div>
          ${me.role==="admin"&&!c.deleted?'<button class="btn admin-comment-btn" id="addAdminProjectComment">+ Добавить комментарий</button>':""}
        </div>
        <div id="adminProjectComments"></div>
      </div>

      <div class="card theses-card" style="box-shadow:none;border:1px solid var(--line);margin-top:14px">
        <div class="theses-head">
          <div>
            <h3 style="margin:0">Тезисы</h3>
            <div class="muted small">Каждый тезис — отдельная кнопка с галочкой. Отмеченные тезисы суммируются и двигают шкалу прогресса.</div>
          </div>
          <div class="theses-total">${projectTheses(c).filter(t=>t.done!==false).length}/${projectTheses(c).length}</div>
        </div>

        <div id="thesesList" class="theses-list"></div>

      </div>

      <div class="card project-comments-card" style="box-shadow:none;border:1px solid var(--line);margin-top:14px">
        <div class="comments-head"><div><h3 style="margin:0">Комментарии</h3><div class="muted small">Обычные и отрицательные комментарии по проекту.</div></div>
        ${!c.deleted?'<button class="btn primary" id="createProjectComment">+ Создать комментарий</button>':""}</div>
        <div id="projectCommentsList" class="project-comments-list"></div>
      </div>

      <div class="grid" style="margin-top:16px">
        <div class="card" style="box-shadow:none;border:1px solid #e5e7eb"><b>Ник</b><div>${esc(c.nick||"—")}</div></div>
        <div class="card" style="box-shadow:none;border:1px solid #e5e7eb"><b>Пол</b><div>${c.gender==="male"?"Твёрдый":c.gender==="female"?"Мягкий":"—"}</div></div>
        <div class="card geo-card" style="box-shadow:none;border:1px solid #e5e7eb"><b>📍 Гео</b><div>${geoLabel(c)}</div></div>
        
      </div>
      
      <div class="card" style="box-shadow:none;border:1px solid var(--line);margin-top:14px">
        <b>Что уже обсуждали</b>
        <div style="white-space:pre-wrap;margin-top:5px">${esc(c.discussion||"—")}</div>
      </div>
      <div class="card block-comments-summary-card" style="box-shadow:none;border:1px solid var(--line);margin-top:12px">
        <div class="comments-head"><div><h3 style="margin:0">Комментарии о блоках</h3><div class="muted small">Все комментарии сгруппированы по названию блока.</div></div></div>
        <div id="blockCommentsSummary"></div>
      </div>

      <div class="card checklist-blocks-card" style="box-shadow:none;border:1px solid var(--line);margin-top:14px">
        <div class="theses-head">
          <div><h3 style="margin:0">Блоки</h3><div class="muted small">Каждый отмеченный блок вместе с тезисами участвует в общем проценте шкалы.</div></div>
          <div class="theses-total">${projectBlocks(c).filter(t=>t.done!==false).length}/${projectBlocks(c).length}</div>
        </div>
        <div class="block-comments-workspace">
          <div id="blockChecklist" class="theses-list"></div>
          <aside id="blockCommentEditor" class="block-comment-editor" hidden></aside>
        </div>
      </div>

      ${canChecklist?`<div class="project-checklist-savebar">
        <div>
          <b>Изменения тезисов и блоков</b>
          <div class="muted small" id="checklistSaveHint">Выберите нужные тезисы и блоки, затем нажмите «Сохранить».</div>
        </div>
        <button class="btn primary project-checklist-save-btn" id="saveProjectChecklist" type="button" disabled>Сохранить</button>
      </div>`:""}

      <div class="actions">${c.deleted?'<span class="pill gray">Проект в корзине — редактирование недоступно</span>':""}${["admin","manager"].includes(me.role)?'<button class="btn ghost" id="viewDialogExport">Последняя выгрузка</button>':""}${me.role==="viewer"&&!c.deleted?'<button class="btn ghost" id="editDialogExport">Добавить / обновить выгрузку</button>':""}${me.role==="viewer"?'<button class="btn ghost" id="renumberProject">Изменить номер</button>':""}${canDelete?'<button class="btn danger" id="deleteProject">Удалить проект</button>':""}${me.role==="viewer"&&c.deleted?'<button class="btn danger" id="deleteProjectForever">Удалить полностью</button>':""}${canEdit?'<button class="btn primary" id="editClient">Редактировать</button>':""}<button class="btn ghost" data-close>Закрыть</button></div>

      <div class="full-history-head">
        <h3>Полная история проекта</h3>
        <div class="muted small">Здесь отображаются изменения карточки, комментарии, тезисы, блоки и время каждого действия.</div>
      </div>
      <div class="timeline full-project-history">${(c.history||[]).slice().sort((a,b)=>String(b.ts||"").localeCompare(String(a.ts||""))).map(h=>`<div class="timeline-item history-${esc(h.type||"general")}">
        <div class="history-time">${h.ts?new Date(h.ts).toLocaleString("ru-RU"):"—"}</div>
        <div class="history-body">
          ${h.type?`<span class="history-kind">${esc(h.type==="thesis"?"Тезис":h.type==="block"?"Блок":h.type==="admin_comment"?"Административные правки":h.type==="block_comment"?"Комментарий блока":h.type==="comment"?"Комментарий":h.type==="edit"?"Изменение":"Событие")}</span>`:""}
          <span>${esc(h.text)}</span>
          ${h.actorName?`<span class="history-actor"> · ${esc(h.actorName)}</span>`:""}
        </div>
      </div>`).join("")||'<div class="muted">Истории пока нет</div>'}</div>

    </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>modal.remove());

    c.adminComments=Array.isArray(c.adminComments)?c.adminComments:[];
    const adminProjectCommentsBox=modal.querySelector("#adminProjectComments");
    const renderAdminProjectComments=()=>{
      if(!adminProjectCommentsBox)return;
      const rows=(c.adminComments||[]).slice().sort((a,b)=>String(b.ts||"").localeCompare(String(a.ts||"")));
      adminProjectCommentsBox.innerHTML=rows.length?rows.map(x=>`<div class="admin-project-comment-item">
        <div class="admin-project-comment-topline">
          <div class="admin-project-comment-meta">Административные правки · ${x.ts?new Date(x.ts).toLocaleString("ru-RU"):""}</div>
          ${me.role==="admin" && String(x.authorId||"")===String(me.id||"") && !c.deleted
            ?`<button class="btn danger small-btn" data-delete-admin-project-comment="${x.id}">Удалить</button>`:""}
        </div>
        <div class="admin-project-comment-text">${esc(x.text||"")}</div>
      </div>`).join(""):'<div class="muted admin-no-comment">Административных правок пока нет.</div>';
      adminProjectCommentsBox.querySelectorAll("[data-delete-admin-project-comment]").forEach(btn=>btn.onclick=async()=>{
        const commentId=btn.dataset.deleteAdminProjectComment;
        if(!confirm("Удалить эту административную правку?"))return;
        btn.disabled=true;
        try{
          const data=await deleteAdminProjectCommentAtomic(c.id,commentId);
          if(!data?.project)throw new Error(data?.error||"Сервер не подтвердил удаление");
          c.adminComments=JSON.parse(JSON.stringify(data.project.adminComments||[]));
          c.history=JSON.parse(JSON.stringify(data.project.history||[]));
          renderAdminProjectComments();
        }catch(e){
          btn.disabled=false;
          alert("Не удалось удалить административную правку: "+(e.message||e));
        }
      });
    };
    renderAdminProjectComments();

    const addAdminCommentBtn=modal.querySelector("#addAdminProjectComment");
    if(addAdminCommentBtn && me.role==="admin"){
      addAdminCommentBtn.onclick=()=>{
        const cm=document.createElement("div");cm.className="modal nested-modal";
        cm.innerHTML=`<div class="modal-card small-modal admin-comment-editor">
          <div class="modal-head"><div><h2>Административные правки</h2><div class="muted small">Комментарий относится только к проекту №${String(c.number).padStart(3,"0")} · ${esc(c.name)}</div></div><button class="icon-btn" data-close>×</button></div>
          <div class="field"><label>Комментарий</label><textarea id="adminProjectCommentText" rows="6" placeholder="Введите важную информацию для менеджера..."></textarea></div>
          <div class="actions"><button class="btn admin-comment-btn" id="saveAdminProjectComment">Сохранить комментарий</button><button class="btn ghost" data-close>Отмена</button></div>
        </div>`;
        document.body.appendChild(cm);
        cm.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>cm.remove());
        cm.querySelector("#saveAdminProjectComment").onclick=async()=>{
          const text=(cm.querySelector("#adminProjectCommentText").value||"").trim();
          if(!text){alert("Введите комментарий");return;}
          const btn=cm.querySelector("#saveAdminProjectComment");
          btn.disabled=true;btn.textContent="Сохраняю...";
          try{
            const data=await addAdminProjectCommentAtomic(c.id,text);
            if(!data?.project)throw new Error(data?.error||"Сервер не подтвердил сохранение");
            const saved=data.project;
            c.adminComments=JSON.parse(JSON.stringify(saved.adminComments||[]));
            c.history=JSON.parse(JSON.stringify(saved.history||[]));
            cm.remove();
            modal.remove();
            openClient(c.id);
          }catch(e){
            btn.disabled=false;btn.textContent="Сохранить комментарий";
            alert("Не удалось сохранить комментарий: "+(e.message||e));
          }
        };
      };
    }

    {
      const renumberBtn=document.getElementById("renumberProject");
      if(renumberBtn && me.role==="viewer"){
        renumberBtn.onclick=()=>{
          const rm=document.createElement("div");
          rm.className="modal nested-modal";
          rm.innerHTML=`<div class="modal-card small-modal">
            <div class="modal-head">
              <div><h2>Изменить номер проекта</h2><div class="muted small">Проект №${String(c.number).padStart(3,"0")} · ${esc(c.name)}</div></div>
              <button class="icon-btn" data-close>×</button>
            </div>
            <div class="field">
              <label>Новый номер проекта</label>
              <input id="newProjectNumber" inputmode="numeric" type="number" min="1" step="1" value="${Number(c.number)||1}" placeholder="Например: 2 или 5">
              <div class="muted small" style="margin-top:6px">Например: 2 будет отображаться как №002, 5 — как №005.</div>
            </div>
            <div class="actions">
              <button class="btn primary" id="saveProjectNumber">Сохранить номер</button>
              <button class="btn ghost" data-close>Отмена</button>
            </div>
          </div>`;
          document.body.appendChild(rm);
          rm.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>rm.remove());
          const inp=rm.querySelector("#newProjectNumber");
          setTimeout(()=>{inp?.focus();inp?.select();},20);
          rm.querySelector("#saveProjectNumber").onclick=async()=>{
            const newNumber=Number(inp.value);
            if(!Number.isInteger(newNumber)||newNumber<1){alert("Введите целый номер от 1 и выше");return;}
            const btn=rm.querySelector("#saveProjectNumber");
            btn.disabled=true;btn.textContent="Сохраняю...";
            try{
              const data=await renumberProjectAtomic(c.id,newNumber);
              if(!data?.ok)throw new Error(data?.error||"Сервер не подтвердил изменение");
              rm.remove();
              modal.remove();
              render();
            }catch(err){
              btn.disabled=false;btn.textContent="Сохранить номер";
              alert("Не удалось изменить номер проекта: "+(err?.message||err));
            }
          };
        };
      }

      const permanentBtn=document.getElementById("deleteProjectForever");
      if(permanentBtn && me.role==="viewer" && c.deleted){
        permanentBtn.onclick=async()=>{
          if(!confirm(`Полностью удалить проект №${String(c.number).padStart(3,"0")} · ${c.name}?\\n\\nВосстановить его будет невозможно.`))return;
          permanentBtn.disabled=true;permanentBtn.textContent="Удаляю...";
          try{
            const data=await deleteProjectForeverAtomic(c.id);
            if(!data?.ok)throw new Error(data?.error||"Сервер не подтвердил удаление");
            modal.remove();
            trashView();
          }catch(err){
            permanentBtn.disabled=false;permanentBtn.textContent="Удалить полностью";
            alert("Не удалось полностью удалить проект: "+(err?.message||err));
          }
        };
      }

      const editBtn=document.getElementById("editClient");
      if(editBtn) editBtn.onclick=()=>{modal.remove();openClientEditor(id)};
      const delBtn=document.getElementById("deleteProject");
      if(delBtn && canDelete) delBtn.onclick=()=>{
        if(!confirm("Переместить проект в корзину? После этого его нельзя будет редактировать.")) return;
        c.deleted=true;c.deletedAt=nowISO();c.history=c.history||[];c.history.push({ts:nowISO(),text:"Проект перемещён в корзину"});
        syncRemote(false);modal.remove();render();
      };
    }

    c.theses = Array.isArray(c.theses) ? c.theses : [];
    c.blockChecks = Array.isArray(c.blockChecks) ? c.blockChecks : [];

    // v61: изменения чек-листа сначала живут только внутри открытого проекта.
    // На сервер они уходят одним пакетом только по кнопке «Сохранить».
    const checklistDraft={
      theses:JSON.parse(JSON.stringify(c.theses)),
      blocks:JSON.parse(JSON.stringify(c.blockChecks))
    };
    const draftProject={...c,theses:checklistDraft.theses,blockChecks:checklistDraft.blocks};
    let checklistDirty=false;

    const checklistSaveBtn=modal.querySelector("#saveProjectChecklist");
    const checklistSaveHint=modal.querySelector("#checklistSaveHint");

    const setChecklistDirty=(dirty=true)=>{
      checklistDirty=!!dirty;
      if(checklistSaveBtn){
        checklistSaveBtn.disabled=!checklistDirty;
        checklistSaveBtn.classList.toggle("has-changes",checklistDirty);
      }
      if(checklistSaveHint){
        checklistSaveHint.textContent=checklistDirty
          ?"Есть несохранённые изменения."
          :"Все выбранные тезисы и блоки сохранены.";
      }
    };

    const refreshDraftProgress=()=>{
      const p=projectProgress(draftProject);
      modal.querySelectorAll(".progress-percent").forEach(el=>el.textContent=`${p}%`);
      const track=modal.querySelector(".pipe-track");
      if(track){
        track.style.setProperty("--progress",`${p*0.94}%`);
        const idx=derivedStageIndex(draftProject);
        track.querySelectorAll(".stage").forEach((el,i)=>{
          el.classList.toggle("done",i<idx);
          el.classList.toggle("current",i===idx);
        });
      }
    };

    const thesesList=document.getElementById("thesesList");

    const renderTheses=()=>{
      if(!thesesList) return;
      const rows=projectTheses(draftProject);
      if(!rows.length){
        thesesList.innerHTML='<div class="muted">Основные тезисы ещё не добавлены наблюдателем или администратором.</div>';
        return;
      }
      const stats=globalThesisStats(draftProject);
      const itemPct=checklistItemPercent(draftProject);
      thesesList.innerHTML=`<div class="thesis-stage-group">
        <div class="thesis-stage-title"><span>Основные тезисы</span><span class="thesis-counter">${stats.done}/${stats.total} проговорено</span></div>
        <div class="thesis-stage-body">
          ${rows.map(t=>`<label class="check-button ${t.done!==false?"checked":""}">
            <input type="checkbox" data-thesis-toggle="${t.id}" ${t.done!==false?"checked":""} ${canChecklist?"":"disabled"}>
            <span class="check-mark">${t.done!==false?"✓":""}</span>
            <span class="check-text">${esc(t.text)}</span>
            <span class="check-percent">+${itemPct.toFixed(1)}%</span>
          </label>`).join("")}
        </div>
      </div>`;
      if(canChecklist){
        thesesList.querySelectorAll("[data-thesis-toggle]").forEach(el=>el.onchange=()=>{
          const t=checklistDraft.theses.find(x=>x.id===el.dataset.thesisToggle);
          if(!t)return;
          t.done=el.checked;
          t.updatedAt=nowISO();
          setChecklistDirty(true);
          renderTheses();
          renderBlockChecklist();
          refreshDraftProgress();
          const totalBox=modal.querySelector(".theses-card .theses-total");
          if(totalBox){
            const s=globalThesisStats(draftProject);
            totalBox.textContent=`${s.done}/${s.total}`;
          }
        });
      }
    };

    renderTheses();


    c.blockComments=Array.isArray(c.blockComments)?c.blockComments:[];
    const blockCommentsSummary=modal.querySelector("#blockCommentsSummary");
    const blockCommentEditor=modal.querySelector("#blockCommentEditor");

    const allBlockCommentGroups=()=>{
      const groups=new Map();
      const add=(blockText,comment)=>{
        const key=String(blockText||"Без названия").trim()||"Без названия";
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(comment);
      };
      (c.blockComments||[]).forEach(x=>add(x.blockText||"Без названия",x));
      (c.blockRecords||[]).forEach(rec=>(rec.comments||[]).forEach(x=>add(rec.block||"Без названия",{...x,legacy:true})));
      return groups;
    };

    const renderBlockCommentsSummary=()=>{
      if(!blockCommentsSummary)return;
      const groups=allBlockCommentGroups();
      if(!groups.size){
        blockCommentsSummary.innerHTML='<div class="muted">Комментариев о блоках пока нет.</div>';
        return;
      }
      blockCommentsSummary.innerHTML=[...groups.entries()].map(([name,rows])=>`<div class="block-comment-group">
        <div class="block-comment-group-title">${esc(name)}</div>
        <div class="block-comment-group-list">${rows.slice().sort((a,b)=>String(b.ts||"").localeCompare(String(a.ts||""))).map(x=>`<div class="block-comment-saved">
          <div class="block-comment-meta">${esc(x.authorName||"Пользователь")} · ${x.ts?new Date(x.ts).toLocaleString("ru-RU"):""}</div>
          <div>${esc(x.text||"")}</div>
        </div>`).join("")}</div>
      </div>`).join("");
    };
    renderBlockCommentsSummary();

    const openInlineBlockComment=(blockId)=>{
      if(!blockCommentEditor)return;
      const row=projectBlocks(draftProject).find(x=>String(x.id)===String(blockId));
      if(!row)return;
      blockCommentEditor.hidden=false;
      blockCommentEditor.innerHTML=`<div class="block-comment-editor-title">Комментарий к блоку</div>
        <div class="block-comment-editor-block">${esc(row.text||"Блок")}</div>
        <textarea id="inlineBlockCommentText" rows="6" placeholder="Напишите комментарий..."></textarea>
        <div class="actions block-comment-editor-actions">
          <button class="btn primary" id="saveInlineBlockComment">Сохранить комментарий</button>
          <button class="btn ghost" id="cancelInlineBlockComment">Отмена</button>
        </div>`;
      const ta=blockCommentEditor.querySelector("#inlineBlockCommentText");
      ta?.focus();
      blockCommentEditor.querySelector("#cancelInlineBlockComment").onclick=()=>{
        blockCommentEditor.innerHTML="";
        blockCommentEditor.hidden=true;
      };
      blockCommentEditor.querySelector("#saveInlineBlockComment").onclick=async()=>{
        const text=(ta?.value||"").trim();
        if(!text){alert("Введите комментарий");return;}
        const btn=blockCommentEditor.querySelector("#saveInlineBlockComment");
        btn.disabled=true;btn.textContent="Сохраняю...";
        try{
          const data=await addBlockCommentAtomic(c.id,row.id,row.text||"",text);
          if(!data?.project)throw new Error(data?.error||"Сервер не подтвердил сохранение");
          c.blockComments=JSON.parse(JSON.stringify(data.project.blockComments||[]));
          c.history=JSON.parse(JSON.stringify(data.project.history||c.history||[]));
          renderBlockCommentsSummary();
          blockCommentEditor.innerHTML=`<div class="block-comment-saved-notice">Сохранено ✓<div class="muted small">${esc(row.text||"")}</div></div>`;
          setTimeout(()=>{
            if(document.body.contains(blockCommentEditor)){
              blockCommentEditor.innerHTML="";
              blockCommentEditor.hidden=true;
            }
          },1100);
        }catch(e){
          btn.disabled=false;btn.textContent="Сохранить комментарий";
          alert("Не удалось сохранить комментарий: "+(e?.message||e));
        }
      };
    };

    const blockChecklist=modal.querySelector("#blockChecklist");
    const renderBlockChecklist=()=>{
      if(!blockChecklist)return;
      const rows=projectBlocks(draftProject);
      const stats=globalBlockStats(draftProject);
      const itemPct=checklistItemPercent(draftProject);
      blockChecklist.innerHTML=rows.length?`<div class="thesis-stage-group">
        <div class="thesis-stage-title"><span>Основные блоки</span><span class="thesis-counter">${stats.done}/${stats.total} отмечено</span></div>
        <div class="thesis-stage-body">
          ${rows.map(b=>`<div class="block-check-comment-row">
            <label class="check-button ${b.done!==false?"checked":""}">
              <input type="checkbox" data-block-toggle="${b.id}" ${b.done!==false?"checked":""} ${canChecklist?"":"disabled"}>
              <span class="check-mark">${b.done!==false?"✓":""}</span>
              <span class="check-text">${esc(b.text)}</span>
              <span class="check-percent">+${itemPct.toFixed(1)}%</span>
            </label>
            ${canBlockComment?`<button type="button" class="btn ghost block-comment-btn" data-block-comment="${b.id}">Комментарий</button>`:""}
          </div>`).join("")}
        </div>
      </div>`:'<div class="muted">Основные блоки ещё не добавлены наблюдателем или администратором.</div>';
      if(canChecklist){
        blockChecklist.querySelectorAll("[data-block-toggle]").forEach(el=>el.onchange=()=>{
          const b=checklistDraft.blocks.find(x=>x.id===el.dataset.blockToggle);
          if(!b)return;
          b.done=el.checked;
          b.updatedAt=nowISO();
          setChecklistDirty(true);
          renderBlockChecklist();
          renderTheses();
          refreshDraftProgress();
          const totalBox=modal.querySelector(".checklist-blocks-card .theses-total");
          if(totalBox){
            const s=globalBlockStats(draftProject);
            totalBox.textContent=`${s.done}/${s.total}`;
          }
        });
      }
      blockChecklist.querySelectorAll("[data-block-comment]").forEach(btn=>btn.onclick=()=>{
        openInlineBlockComment(btn.dataset.blockComment);
      });
    };
    renderBlockChecklist();

    if(checklistSaveBtn){
      checklistSaveBtn.onclick=async()=>{
        if(!checklistDirty)return;
        const oldText=checklistSaveBtn.textContent;
        checklistSaveBtn.disabled=true;
        checklistSaveBtn.textContent="Сохраняю...";
        if(checklistSaveHint)checklistSaveHint.textContent="Сохраняем выбранные тезисы и блоки...";

        try{
          const data=await saveProjectChecklistBatch(c.id,checklistDraft.theses,checklistDraft.blocks);
          const saved=data?.project;

          if(saved){
            c.theses=JSON.parse(JSON.stringify(saved.theses||checklistDraft.theses));
            c.blockChecks=JSON.parse(JSON.stringify(saved.blockChecks||checklistDraft.blocks));
            c.history=JSON.parse(JSON.stringify(saved.history||c.history||[]));

            // Синхронизируем черновик с реально сохранённым проектом.
            checklistDraft.theses=JSON.parse(JSON.stringify(c.theses));
            checklistDraft.blocks=JSON.parse(JSON.stringify(c.blockChecks));
            draftProject.theses=checklistDraft.theses;
            draftProject.blockChecks=checklistDraft.blocks;
          }else{
            c.theses=JSON.parse(JSON.stringify(checklistDraft.theses));
            c.blockChecks=JSON.parse(JSON.stringify(checklistDraft.blocks));
          }

          setChecklistDirty(false);
          refreshDraftProgress();
          checklistSaveBtn.textContent="Сохранено ✓";
          if(checklistSaveHint)checklistSaveHint.textContent="Все выбранные тезисы и блоки сохранены.";

          setTimeout(()=>{
            if(document.body.contains(checklistSaveBtn)){
              checklistSaveBtn.textContent=oldText;
              checklistSaveBtn.disabled=true;
            }
          },1200);
        }catch(e){
          console.error("Checklist save error:",e);
          checklistSaveBtn.disabled=false;
          checklistSaveBtn.textContent=oldText;
          if(checklistSaveHint)checklistSaveHint.textContent="Не удалось сохранить. Нажмите «Сохранить» ещё раз.";
          alert("Не удалось сохранить тезисы и блоки: "+(e?.message||e));
        }
      };
    }

    c.projectComments=Array.isArray(c.projectComments)?c.projectComments:[];
    const commentsList=modal.querySelector("#projectCommentsList");
    const renderProjectComments=()=>{
      if(!commentsList)return;
      const rows=c.projectComments.slice().sort((a,b)=>String(b.ts).localeCompare(String(a.ts)));
      commentsList.innerHTML=rows.length?rows.map(x=>`<div class="project-comment ${x.type==="negative"?"negative":""}">
        <div class="project-comment-top"><div><b>${x.type==="negative"?"Отрицательный комментарий":"Комментарий"}</b><span class="muted small"> · ${esc(x.authorName||"")} · ${new Date(x.ts).toLocaleString("ru-RU")}</span></div>
        ${!c.deleted?`<button class="btn ghost small-btn" data-edit-project-comment="${x.id}">Редактировать</button>`:""}</div>
        <div class="project-comment-text">${esc(x.text)}</div>
      </div>`).join(""):'<div class="muted">Комментариев пока нет.</div>';
      commentsList.querySelectorAll("[data-edit-project-comment]").forEach(btn=>btn.onclick=()=>openProjectCommentEditor(btn.dataset.editProjectComment));
    };

    const openProjectCommentEditor=(commentId=null)=>{
      const existing=commentId?c.projectComments.find(x=>x.id===commentId):null;
      const cm=document.createElement("div");cm.className="modal nested-modal";
      cm.innerHTML=`<div class="modal-card small-modal"><div class="modal-head"><h2>${existing?"Редактировать":"Создать"} комментарий</h2><button class="icon-btn" data-close>×</button></div>
        <div class="field"><label>Тип</label><select id="projectCommentType"><option value="normal" ${existing?.type!=="negative"?"selected":""}>Обычный комментарий</option><option value="negative" ${existing?.type==="negative"?"selected":""}>Отрицательный комментарий</option></select></div>
        <div class="field" style="margin-top:12px"><label>Текст</label><textarea id="projectCommentText">${esc(existing?.text||"")}</textarea></div>
        <div class="actions"><button class="btn primary" id="saveProjectComment">Сохранить</button><button class="btn ghost" data-close>Отмена</button></div></div>`;
      document.body.appendChild(cm);cm.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>cm.remove());
      cm.querySelector("#saveProjectComment").onclick=()=>{
        const text=cm.querySelector("#projectCommentText").value.trim();if(!text){alert("Введите комментарий");return}
        const type=cm.querySelector("#projectCommentType").value;
        const eventTs=nowISO();
        if(existing){
          existing.text=text;existing.type=type;existing.updatedAt=eventTs;
          c.history=c.history||[];
          c.history.push({ts:eventTs,type:"comment",actorName:me.name,text:`Комментарий отредактирован: «${text}»`});
        }else{
          c.projectComments.push({id:uid("pc_"),type,text,ts:eventTs,authorId:me.id,authorName:me.name});
          c.history=c.history||[];
          c.history.push({ts:eventTs,type:"comment",actorName:me.name,text:`Добавлен ${type==="negative"?"отрицательный ":""}комментарий: «${text}»`});
        }
        syncRemote(false);cm.remove();renderProjectComments();
      };
    };
    renderProjectComments();
    const createCommentBtn=modal.querySelector("#createProjectComment");
    if(createCommentBtn)createCommentBtn.onclick=()=>openProjectCommentEditor();

    c.blockRecords = Array.isArray(c.blockRecords) ? c.blockRecords : [];

    const savedBlocksList=document.getElementById("savedBlocksList");
    const multiBlockSelect=document.getElementById("multiBlockSelect");
    const multiReactionSelect=document.getElementById("multiReactionSelect");
    const multiBlockComment=document.getElementById("multiBlockComment");
    const saveMultiBlock=document.getElementById("saveMultiBlock");

    const renderSavedBlocks=()=>{
      if(!savedBlocksList) return;
      if(!c.blockRecords.length){
        savedBlocksList.innerHTML='<div class="muted">Сохранённых блоков пока нет.</div>';
        return;
      }
      savedBlocksList.innerHTML=c.blockRecords.map((rec,idx)=>{
        const comments=(rec.comments||[]).slice().sort((a,b)=>b.ts.localeCompare(a.ts));
        return `<div class="saved-block-row">
          <div class="saved-block-top">
            <div><b>${esc(rec.block)}</b><span class="reaction-badge">${esc(rec.reaction||"Реакция не указана")}</span></div>
            ${canBlockComment?`<div class="saved-block-actions">
              <button class="btn ghost small-btn" data-edit-saved-block="${idx}">Выбрать</button>
              <button class="btn danger small-btn" data-delete-saved-block="${idx}">Удалить блок</button>
            </div>`:""}
          </div>
          <div class="saved-block-comments">
            ${comments.length?comments.map(x=>`<div class="saved-comment"><div class="saved-comment-meta">${esc(x.authorName||"Пользователь")} · ${new Date(x.ts).toLocaleString("ru-RU")}</div><div>${esc(x.text)}</div></div>`).join(""):'<div class="muted small">Комментариев по этому блоку нет.</div>'}
          </div>
        </div>`;
      }).join("");

      document.querySelectorAll("[data-edit-saved-block]").forEach(btn=>btn.onclick=()=>{
        const rec=c.blockRecords[Number(btn.dataset.editSavedBlock)];
        if(!rec || !multiBlockSelect || !multiReactionSelect) return;
        multiBlockSelect.value=rec.block;
        multiReactionSelect.value=rec.reaction||"";
        if(multiBlockComment) multiBlockComment.value="";
      });

      document.querySelectorAll("[data-delete-saved-block]").forEach(btn=>btn.onclick=()=>{
        const idx=Number(btn.dataset.deleteSavedBlock);
        const rec=c.blockRecords[idx];
        if(!rec) return;
        if(!confirm(`Удалить «${rec.block}» вместе с реакцией и всеми комментариями этого блока?`)) return;

        c.blockRecords.splice(idx,1);

        c.history=c.history||[];
        c.history.push({
          ts:nowISO(),
          text:`Удалён «${rec.block}» вместе с реакцией и комментариями`
        });

        syncRemote(false);

        if(multiBlockSelect && multiBlockSelect.value===rec.block){
          multiBlockSelect.value="";
          multiReactionSelect.value="";
          if(multiBlockComment) multiBlockComment.value="";
        }

        renderSavedBlocks();
      });
    };

    if(saveMultiBlock){
      saveMultiBlock.onclick=()=>{
        const block=(multiBlockSelect?.value||"").trim();
        const reaction=(multiReactionSelect?.value||"").trim();
        const comment=(multiBlockComment?.value||"").trim();

        if(!block){ alert("Выберите блок"); return; }
        if(!reaction){ alert("Выберите реакцию на блок"); return; }

        let rec=c.blockRecords.find(x=>x.block===block);
        if(!rec){
          rec={block,reaction,comments:[]};
          c.blockRecords.push(rec);
        }else{
          rec.reaction=reaction;
          rec.comments=Array.isArray(rec.comments)?rec.comments:[];
        }

        if(comment){
          rec.comments.push({
            ts:nowISO(),
            text:comment,
            authorId:me.id,
            authorName:me.name
          });
        }

        c.history=c.history||[];
        c.history.push({
          ts:nowISO(),
          text:`Сохранён «${block}»: реакция — ${reaction}${comment?" + комментарий":""}`
        });

        syncRemote(false);
        if(multiBlockComment) multiBlockComment.value="";
        renderSavedBlocks();
      };
    }

    renderSavedBlocks();

    const viewExportBtn=document.getElementById("viewDialogExport");
    if(viewExportBtn) viewExportBtn.onclick=()=>{modal.remove();openDialogExport(id);};
    const editExportBtn=document.getElementById("editDialogExport");
    if(editExportBtn) editExportBtn.onclick=()=>{modal.remove();openDialogExport(id);};

  }

  function openClientEditor(id){
    if(id){ const existing=db.clients.find(x=>x.id===id); if(existing?.deleted){alert("Удалённые проекты нельзя редактировать");return;} }
    const me=db.users.find(u=>u.id===session.userId), c=id?db.clients.find(x=>x.id===id):null;
    const modal=document.createElement("div");modal.className="modal";
    modal.innerHTML=`<div class="modal-card"><div class="modal-head"><div><h2>${c?"Редактировать проект":"Новый проект"}</h2><div class="muted small">Все поля можно изменить позже</div></div><button class="icon-btn" data-close>×</button></div>
      <form id="clientForm" class="form-grid">
        <div class="field"><label>Имя</label><input name="name" required value="${esc(c?.name||"")}"></div>
        <div class="field"><label>Ник</label><input name="nick" value="${esc(c?.nick||"")}" placeholder="Введите ник"></div>
        <div class="field"><label>Возраст</label><input name="age" value="${esc(c?.age||"")}"></div><div class="field"><label>Пол</label><select name="gender">
          <option value="">Не указан</option>
          <option value="male" ${c?.gender==="male"?"selected":""}>Твёрдый</option>
          <option value="female" ${c?.gender==="female"?"selected":""}>Мягкий</option>
        </select></div>
        <div class="field"><label>📍 Гео</label><select name="geoType">
          <option value="">Не указано</option>
          <option value="russia" ${c?.geoType==="russia"?"selected":""}>Классика</option>
          <option value="belarus" ${c?.geoType==="belarus"?"selected":""}>Усы</option>
          <option value="europe" ${c?.geoType==="europe"?"selected":""}>Радуга</option>
          <option value="other" ${c?.geoType==="other"?"selected":""}>Иное</option>
        </select></div>
        <div class="field"><label>Уточнение</label><input name="region" value="${esc(c?.region||"")}" placeholder="111"></div>
        <div class="field"><label>Дата начала общения</label><input type="date" name="startDate" required value="${esc(c?.startDate||new Date().toISOString().slice(0,10))}"></div>
        <div class="field"><label>Профессия</label><input name="profession" value="${esc(c?.profession||"")}"></div>
        <div class="field full"><label>Интересы</label><input name="interests" value="${esc(c?.interests||"")}"></div>
        <div class="field full"><label>Что уже обсуждали</label>
          <textarea name="discussion" placeholder="Например: познакомились, обсудили цели">${esc(c?.discussion||"")}</textarea>
        </div>
        <div class="field full"><label>Заметки менеджера</label>
          <textarea name="notes" placeholder="Например: перезвонить после выходных">${esc(c?.notes||"")}</textarea>
        </div>
        ${me.role==="admin"?`<div class="field full"><label>Менеджер</label><select name="managerId">${db.users.filter(u=>u.role==="manager").map(u=>`<option value="${u.id}" ${(c?.managerId||"")===u.id?"selected":""}>${esc(u.name)}</option>`).join("")}</select></div>`:""}
        <div class="actions field full"><button type="button" class="btn ghost" data-close>Отмена</button><button class="btn primary">Сохранить</button></div>
      </form></div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>modal.remove());
    modal.querySelector("#clientForm").onsubmit=e=>{
      e.preventDefault();const fd=new FormData(e.target);
      if(c){
        const before={
          name:c.name,nick:c.nick,age:c.age,gender:c.gender,geoType:c.geoType,region:c.region,
          startDate:c.startDate,profession:c.profession,discussion:c.discussion,notes:c.notes,
          interests:c.interests,managerId:c.managerId
        };
        const after={
          name:fd.get("name"),nick:fd.get("nick"),age:fd.get("age"),gender:fd.get("gender"),
          geoType:fd.get("geoType"),region:fd.get("region"),startDate:fd.get("startDate"),
          profession:fd.get("profession"),discussion:fd.get("discussion"),notes:fd.get("notes"),
          interests:fd.get("interests"),managerId:me.role==="admin"?fd.get("managerId"):c.managerId
        };
        Object.assign(c,after);
        const managerStages=managerConfig(c.managerId).funnelStages;
        c.stageIndex=Math.min(Number(c.stageIndex)||0,Math.max(0,managerStages.length-1));
        delete c.stages;
        c.blockRecords=Array.isArray(c.blockRecords)?c.blockRecords:[];
        c.theses=Array.isArray(c.theses)?c.theses:[];
        c.history=c.history||[];
        const labels={name:"Имя",nick:"Ник",age:"Возраст",gender:"Пол",geoType:"Гео",region:"Уточнение GEO",startDate:"Дата начала общения",profession:"Профессия",discussion:"Что уже обсуждали",notes:"Заметки менеджера",interests:"Интересы",managerId:"Менеджер"};
        const eventTs=nowISO();
        Object.keys(after).forEach(key=>{
          if(String(before[key]??"")!==String(after[key]??"")){
            let oldVal=String(before[key]??"—"),newVal=String(after[key]??"—");
            if(key==="gender"){oldVal=before[key]==="male"?"Твёрдый":before[key]==="female"?"Мягкий":"—";newVal=after[key]==="male"?"Твёрдый":after[key]==="female"?"Мягкий":"—";}
            if(key==="geoType"){
              const gm={russia:"Классика",belarus:"Усы",europe:"Радуга",other:"Иное"};
              oldVal=gm[before[key]]||"—";newVal=gm[after[key]]||"—";
            }
            if(key==="managerId"){
              oldVal=db.users.find(u=>u.id===before[key])?.name||"—";
              newVal=db.users.find(u=>u.id===after[key])?.name||"—";
            }
            c.history.push({ts:eventTs,type:"edit",actorName:me.name,text:`${labels[key]}: «${oldVal}» → «${newVal}»`});
          }
        });
      }else{
        const nextNum=Math.max(0,...db.clients.map(x=>x.number||0))+1;
        db.clients.push({id:uid("c_"),number:nextNum,name:fd.get("name"),nick:fd.get("nick"),age:fd.get("age"),gender:fd.get("gender"),geoType:fd.get("geoType"),region:fd.get("region"),managerId:me.role==="admin"?fd.get("managerId"):me.id,profession:fd.get("profession"),discussion:fd.get("discussion"),notes:fd.get("notes"),interests:fd.get("interests"),startDate:fd.get("startDate"),stageIndex:0,deleted:false,blockRecords:[],blockChecks:[],theses:[],projectComments:[],history:[{ts:nowISO(),type:"edit",actorName:me.name,text:"Создан проект"}]});
      }
      syncRemote(false);modal.remove();render();
    };
  }


  function trainingAdminView(){
    const me=db.users.find(u=>u.id===session.userId);
    if(!me||me.role!=="viewer")return render();
    const trainees=(db.users||[]).filter(u=>u.role==="trainee");
    shell(`${nav("trainingAdmin",me)}
      <div class="section-head"><div><h1>Обучение</h1><p class="muted">Учебные аккаунты, материалы и прогресс.</p></div><button class="btn primary" id="createTrainee">+ Создать аккаунт</button></div>
      <div class="training-admin-grid">${trainees.length?trainees.map(u=>{const s=trainingProgress(u.id);return `<div class="card trainee-card">
        <div class="trainee-card-head"><div><h3>${esc(u.name)}</h3><div class="muted small">Логин: ${esc(u.login)}</div></div><span class="training-percent">${s.percent}%</span></div>
        <div class="training-progress"><span style="width:${s.percent}%"></span></div>
        <div class="training-stats"><b>${s.done} из ${s.total}</b> материалов прочитано</div>
        <div class="actions"><button class="btn primary" data-open-trainee="${u.id}">Материалы</button><button class="btn danger" data-delete-trainee="${u.id}">Удалить</button></div>
      </div>`}).join(""):'<div class="card empty">Учебных аккаунтов пока нет.</div>'}</div>`);
    wireNav();
    document.getElementById("createTrainee").onclick=()=>{
      const m=document.createElement("div");m.className="modal";
      m.innerHTML=`<div class="modal-card small-modal"><div class="modal-head"><div><h2>Аккаунт для обучения</h2><div class="muted small">Пользователь увидит только своё обучение.</div></div><button class="icon-btn" data-close>×</button></div>
      <form id="traineeCreateForm"><div class="field"><label>Имя</label><input name="name" required></div><div class="field" style="margin-top:12px"><label>Логин</label><input name="login" required></div><div class="field" style="margin-top:12px"><label>Пароль</label><input type="password" name="password" required></div><div class="actions"><button class="btn primary">Создать</button><button type="button" class="btn ghost" data-close>Отмена</button></div></form></div>`;
      document.body.appendChild(m);m.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>m.remove());
      m.querySelector("#traineeCreateForm").onsubmit=async e=>{
        e.preventDefault();const fd=new FormData(e.target),btn=e.target.querySelector("button");btn.disabled=true;btn.textContent="Создаю...";
        try{const d=await createTrainingAccountAtomic({name:String(fd.get("name")||"").trim(),login:String(fd.get("login")||"").trim(),password:String(fd.get("password")||"")});alert(`${d.loginAdjusted?"Такой логин уже был занят, поэтому создан новый учебный логин.\n\n":""}Аккаунт создан.\nЛогин: ${d.login}\nПароль: ${fd.get("password")}`);m.remove();trainingAdminView();}
        catch(err){btn.disabled=false;btn.textContent="Создать";alert(err.message||err);}
      };
    };
    document.querySelectorAll("[data-open-trainee]").forEach(b=>b.onclick=()=>openTrainingManager(b.dataset.openTrainee));
    document.querySelectorAll("[data-delete-trainee]").forEach(b=>b.onclick=async()=>{const id=b.dataset.deleteTrainee;if(!confirm("Удалить учебный аккаунт и его файлы?"))return;b.disabled=true;try{await deleteTrainingAccountAtomic(id);trainingAdminView();}catch(e){b.disabled=false;alert(e.message||e);}});
  }

  function openTrainingManager(id){
    const me=db.users.find(u=>u.id===session.userId),u=db.users.find(x=>x.id===id&&x.role==="trainee");
    if(!me||me.role!=="viewer"||!u)return;
    const p=trainingProgram(id),s=trainingProgress(id),readSet=new Set(p.readFileIds.map(String));
    const m=document.createElement("div");m.className="modal";
    m.innerHTML=`<div class="modal-card training-manager-modal"><div class="modal-head"><div><h2>Обучение · ${esc(u.name)}</h2><div class="muted small">Логин: ${esc(u.login)}</div></div><button class="icon-btn" data-close>×</button></div>
      <div class="training-summary-card"><div><b>Прогресс обучения</b><div class="muted small">${s.done} из ${s.total}</div></div><strong>${s.percent}%</strong><div class="training-progress wide"><span style="width:${s.percent}%"></span></div></div>
      <div class="card"><h3 style="margin-top:0">Добавить материал</h3><div class="form-grid"><div class="field"><label>Название</label><input id="trainingFileTitle" placeholder="Урок 1"></div><div class="field"><label>Файл</label><input id="trainingFileInput" type="file"></div></div><div class="muted small">Максимум 10 МБ на файл.</div><button class="btn primary" id="uploadTrainingFile" style="margin-top:12px">Загрузить файл</button></div>
      <div class="training-files-admin">${p.files.length?p.files.map((f,i)=>`<div class="training-file-row"><div class="training-file-index">${i+1}</div><div class="training-file-info"><b>${esc(f.title||f.fileName)}</b><span>${esc(f.fileName||"")}</span></div><span class="pill ${readSet.has(String(f.id))?"green":"gray"}">${readSet.has(String(f.id))?"Прочитано":"Не открыто"}</span><a class="btn ghost" href="${esc(f.url||"#")}" target="_blank" rel="noopener">Открыть</a><button class="btn danger small-btn" data-delete-training-file="${f.id}">Удалить</button></div>`).join(""):'<div class="card empty">Материалов пока нет.</div>'}</div></div>`;
    document.body.appendChild(m);m.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>m.remove());
    m.querySelector("#uploadTrainingFile").onclick=async()=>{const file=m.querySelector("#trainingFileInput").files?.[0],title=(m.querySelector("#trainingFileTitle").value||"").trim();if(!file)return alert("Выберите файл");if(file.size>10*1024*1024)return alert("Максимум 10 МБ");const b=m.querySelector("#uploadTrainingFile");b.disabled=true;b.textContent="Загружаю...";try{await uploadTrainingFileAtomic(id,file,title||file.name);m.remove();openTrainingManager(id);}catch(e){b.disabled=false;b.textContent="Загрузить файл";alert(e.message||e);}};
    m.querySelectorAll("[data-delete-training-file]").forEach(b=>b.onclick=async()=>{if(!confirm("Удалить файл?"))return;b.disabled=true;try{await deleteTrainingFileAtomic(id,b.dataset.deleteTrainingFile);m.remove();openTrainingManager(id);}catch(e){b.disabled=false;alert(e.message||e);}});
  }

  function traineeTrainingView(){
    const me=db.users.find(u=>u.id===session.userId);if(!me||me.role!=="trainee")return render();
    const p=trainingProgram(me.id),s=trainingProgress(me.id),readSet=new Set(p.readFileIds.map(String));
    shell(`${nav("training",me)}<div class="training-hero"><div><span class="training-kicker">ВАШЕ ОБУЧЕНИЕ</span><h1>${esc(me.name)}</h1><p>Открывайте материалы. Каждый открытый материал увеличивает прогресс.</p></div><div class="training-big-percent">${s.percent}%</div></div>
      <div class="card trainee-progress-card"><div class="trainee-progress-head"><div><b>Шкала прогресса обучения</b><div class="muted small">Пройдено ${s.done} из ${s.total}</div></div><strong>${s.percent}%</strong></div><div class="training-progress large"><span style="width:${s.percent}%"></span></div></div>
      <div class="training-lessons">${p.files.length?p.files.map((f,i)=>{const read=readSet.has(String(f.id));return `<button class="training-lesson ${read?"read":""}" data-training-open="${f.id}" data-url="${esc(f.url||"")}"><span class="lesson-number">${read?"✓":i+1}</span><span class="lesson-main"><b>${esc(f.title||f.fileName)}</b><small>${read?"Материал открыт":"Нажмите, чтобы открыть"}</small></span><span class="lesson-status">${read?"Прочитано":"Открыть"}</span></button>`}).join(""):'<div class="card empty">Материалы ещё не добавлены.</div>'}</div>`);
    wireNav();
    document.querySelectorAll("[data-training-open]").forEach(b=>b.onclick=async()=>{if(b.dataset.url)window.open(b.dataset.url,"_blank","noopener");try{await markTrainingFileReadAtomic(b.dataset.trainingOpen);traineeTrainingView();}catch(e){alert("Материал открыт, но прогресс не сохранился. Попробуйте ещё раз.");}});
  }

  let currentRoute=null;
  function route(r){
    currentRoute=r;
    const users=Array.isArray(db?.users)?db.users:[]; const me=users.find(u=>u.id===session.userId)||users.find(u=>u.role==="admin")||users[0];
    if(!me)return loginView();
    if(me.role==="trainee")return traineeTrainingView();
    if(r==="trash")return trashView();
    if(me.role==="manager"&&r==="notebook")return notebookView();
    if(me.role==="admin"||me.role==="viewer"){
      if(r==="managers")return adminManagers();
      if(r==="statistics"&&me.role==="viewer")return observerStatisticsView();
      if(r==="allclients")return adminAllClients();
      if(r==="trainingAdmin"&&me.role==="viewer")return trainingAdminView();
      if(r==="users"&&me.role==="admin")return usersView();
      return adminDashboard();
    }
    return managerView();
  }
  function render(){
    if(!session)return loginView();
    const users=Array.isArray(db?.users)?db.users:[]; const me=users.find(u=>u.id===session.userId)||users.find(u=>u.role==="admin")||users[0];
    if(!me||!me.active){logout();return}
    route(currentRoute || (me.role==="trainee"?"training":((me.role==="admin"||me.role==="viewer")?"dashboard":"clients")));
  }
  async function bootstrap(){
    try{
      if(session?.token){
        try{
          const cached=JSON.parse(localStorage.getItem(CACHE_KEY)||"null");
          if(cached && Array.isArray(cached.users)) db=cached;
        }catch(e){}

        // v82: интерфейс появляется сразу, сервер обновляет данные после отрисовки.
        render();
        setTimeout(async()=>{
          try{
            const ok=await fetchState();
            if(ok && session) {
              // Не дёргаем экран во время открытой модалки.
              if(!document.querySelector(".modal")) render();
            }
          }catch(e){ console.warn("background bootstrap refresh",e); }
        },250);
        return;
      }
      render();
    }catch(e){
      console.error("Bootstrap error:",e);
      try{
        session=null;
        localStorage.removeItem(sessionKey);
      }catch(_){}
      try{
        loginView();
      }catch(inner){
        const root=document.getElementById("app")||document.body;
        root.innerHTML='<div style="max-width:560px;margin:70px auto;padding:24px;font-family:Arial,sans-serif;color:#111827;background:white;border:1px solid #d1d5db;border-radius:16px"><h2 style="margin-top:0">Цитадель</h2><p>Интерфейс не загрузился из-за ошибки браузерного кэша.</p><button onclick="localStorage.clear();location.reload()" style="padding:10px 16px;border:0;border-radius:10px;background:#f59e0b;font-weight:700;cursor:pointer">Очистить кэш и перезагрузить</button></div>';
      }
    }
  }
  window.__citadelLoaded=true;
  bootstrap();
})();