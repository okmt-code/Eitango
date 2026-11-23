/* iPad・iPhone 対応レイヤー(英単語・英文法アプリ共通)
   元のアプリ(../eitango.html, ../bunpou.html)は変更せず、このファイルで動きを足します。
   - タッチ操作: キー表示を隠す、単語カードの左右スワイプ、解答後のスクロール
   - 読み上げ: iOS の英語の声を選ぶ(面白音声を避ける)、最初のタップで読み上げを有効化
   - オフライン: service worker(sw.js)を登録
   - 記録の書き出し: iOS では共有シートから「ファイルに保存」 */
(function(){
  "use strict";
  var root = document.documentElement;
  var APP = root.getAttribute("data-app") || "";
  var $ = function(id){ return document.getElementById(id); };
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var standalone = navigator.standalone === true || (window.matchMedia && matchMedia("(display-mode: standalone)").matches);
  if (isIOS) root.classList.add("ios");
  if (standalone) root.classList.add("standalone");
  function store(k, v){ try{ if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); }catch(e){ return null; } }

  /* ===== 入力モード(タッチ / キーボード) ===== */
  var coarse = window.matchMedia && matchMedia("(hover: none) and (pointer: coarse)").matches;
  root.setAttribute("data-input", coarse ? "touch" : "keys");
  var isTouch = function(){ return root.getAttribute("data-input") === "touch"; };
  addEventListener("touchstart", function(){ if (!isTouch()){ root.setAttribute("data-input", "touch"); fixTexts(); } }, {passive:true, capture:true});
  addEventListener("keydown", function(e){
    if (e.ctrlKey || e.metaKey) return;
    if (e.key && (e.key.length === 1 || /^(Enter|Arrow|Backspace|Escape)/.test(e.key))) root.setAttribute("data-input", "keys");
  }, true);

  /* ===== 文言の置きかえ ===== */
  var ALWAYS = [
    // 記録の保存場所の説明
    ["p", "このパソコンのブラウザ内", "記録はこの端末の中だけに保存されます(ほかの端末とは共有されません)。Safari で開いたときと、ホーム画面のアイコンから開いたときでも記録は別々になるので、いつも同じ開き方で使ってください。"]
  ];
  var TOUCH = [
    ["#cardBox .hint", "裏返す", "タップで裏返す ・ 左右にスワイプで前へ / 次へ"],
    ["#cardBox p.muted", "もう一周", function(el){ var m = el.textContent.match(/^[^。]*。/); return (m ? m[0] : "") + "「次へ →」でもう一周できます。"; }],
    [".instr", "数字キー", "[ ] に入るように、語句を順にタップして並べましょう。置いた語句をタップすると外せます。並べ終えたら「答え合わせ」。"]
  ];
  function applyList(list){
    list.forEach(function(r){
      document.querySelectorAll(r[0]).forEach(function(el){
        if (el.getAttribute("data-ios-fixed") || el.textContent.indexOf(r[1]) < 0) return;
        el.textContent = typeof r[2] === "function" ? r[2](el) : r[2];
        el.setAttribute("data-ios-fixed", "1");
      });
    });
  }
  function fixTexts(){ applyList(ALWAYS); if (isTouch()) applyList(TOUCH); }

  /* キーボード操作の説明パネルに印を付ける(タッチ時は隠す) */
  document.querySelectorAll(".panel > h2").forEach(function(h){
    if (/キーボード操作/.test(h.textContent)) h.parentNode.classList.add("ios-keys-panel");
  });
  /* 単語カードのボタン列(iPhone では2段に並べる) */
  if ($("cardPrev")) $("cardPrev").parentNode.classList.add("card-actions");

  /* ===== 案内パネル(ホーム) ===== */
  var other = APP === "eitango" ? ["bunpou.html", "英文法トレーニング"] : ["eitango.html", "英単語トレーニング"];
  var home = $("view-home");
  if (home){
    var shareIcon = '<svg class="ios-share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11v9h12v-9"/></svg>';
    if (isIOS && !standalone && store("ios.hideA2HS") !== "1"){
      var b = document.createElement("div");
      b.className = "panel ios-banner";
      b.innerHTML = '<b>ホーム画面に追加すると便利です</b><p class="small" style="margin:6px 0 0">Safari の共有ボタン ' + shareIcon + ' →「ホーム画面に追加」。アプリのように全画面で開け、ネットにつながっていなくても使えます。</p><button class="ios-close" aria-label="閉じる">×</button>';
      b.querySelector(".ios-close").addEventListener("click", function(){ b.remove(); store("ios.hideA2HS", "1"); });
      home.insertBefore(b, home.firstChild);
    }
    var g = document.createElement("div");
    g.className = "panel ios-guide";
    g.innerHTML = '<h2>iPad・iPhone で使うとき</h2>'
      + (APP === "eitango" ? '<p class="small">発音が聞こえないときは、iPhone の消音モード(マナーモード)をオフにして、音量を上げてください。</p>' : '')
      + '<p class="small ios-touch-only">ボタンや選択肢はタップで操作できます。iPad にキーボードをつないだときは、パソコン版と同じキー操作も使えます。</p>'
      + '<div class="row"><a class="btn secondary" href="' + other[0] + '" style="text-decoration:none">' + other[1] + 'を開く</a></div>';
    home.appendChild(g);
  }

  /* ===== 単語カードのスワイプ ===== */
  var cb = $("cardBox");
  if (cb && typeof window.nextCard === "function"){
    var sx = 0, sy = 0, st = 0, swiped = false;
    cb.addEventListener("touchstart", function(e){ var t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); swiped = false; }, {passive:true});
    cb.addEventListener("touchend", function(e){
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - st < 900){
        swiped = true;
        cb.classList.remove("ios-swipe-l", "ios-swipe-r"); void cb.offsetWidth;
        if (dx < 0){ window.nextCard(); cb.classList.add("ios-swipe-l"); } else { window.prevCard(); cb.classList.add("ios-swipe-r"); }
      }
    }, {passive:true});
    cb.addEventListener("click", function(e){ if (swiped){ swiped = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  }

  /* ===== 練習・クイズ: 解答後に解説を見えるように、次の問題で上に戻す ===== */
  var qb = $("quizBox");
  if (qb && window.MutationObserver){
    new MutationObserver(function(muts){
      var newQ = false, answered = false;
      muts.forEach(function(m){ if (m.target === qb) newQ = true; else if (m.target.id === "after" && m.addedNodes.length) answered = true; });
      if (newQ && qb.getBoundingClientRect().top < 0) window.scrollTo(0, 0);
      if (answered){
        var fb = $("fb"); if (!fb) return;
        var r = fb.getBoundingClientRect(), navH = (window.innerWidth <= 600 && document.querySelector("nav")) ? document.querySelector("nav").offsetHeight : 0;
        if (r.bottom > window.innerHeight - navH - 60) fb.scrollIntoView({block: "center", behavior: "smooth"});
      }
    }).observe(qb, {childList:true, subtree:true});
  }
  if (window.MutationObserver) new MutationObserver(fixTexts).observe(document.querySelector("main") || document.body, {childList:true, subtree:true});
  fixTexts();

  /* ===== 読み上げ(iOS Safari) ===== */
  if ("speechSynthesis" in window){
    var synth = window.speechSynthesis;
    // iOS には英語の「面白音声」(Bubbles, Zarvox など)があり、自動選択で選ばれると聞き取れないので避ける
    var NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Junior|Kathy|Organ|Pipe Organ|Princess|Ralph|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Grandma|Grandpa|Eddy|Flo|Reed|Rocko|Sandy|Shelley)\b/i;
    var PREFER = ["Samantha", "Ava", "Allison", "Susan", "Nicky", "Joelle", "Tom", "Alex", "Aaron", "Evan", "Zoe"];
    var best = null;
    var pickBest = function(){
      var vs = []; try{ vs = synth.getVoices() || []; }catch(e){}
      var us = vs.filter(function(v){ return /^en[-_]US/i.test(v.lang) && !NOVELTY.test(v.name); });
      var en = us.length ? us : vs.filter(function(v){ return /^en/i.test(v.lang) && !NOVELTY.test(v.name); });
      best = null;
      for (var i = 0; i < PREFER.length && !best; i++) best = en.filter(function(v){ return v.name.indexOf(PREFER[i]) === 0; })[0] || null;
      best = best || en.filter(function(v){ return v.default; })[0] || en[0] || null;
    };
    pickBest();
    try{ synth.addEventListener("voiceschanged", pickBest); }catch(e){}
    var userChoseVoice = function(){ try{ return typeof S !== "undefined" && S.settings && S.settings.voice; }catch(e){ return false; } };
    var origSpeak = synth.speak.bind(synth);
    synth.speak = function(u){
      try{
        if (!best) pickBest();
        var needs = !u.voice || (NOVELTY.test(u.voice.name) && !userChoseVoice());
        if (best && needs && (!u.lang || /^en/i.test(u.lang))){ u.voice = best; u.lang = best.lang; }
      }catch(e){}
      return origSpeak(u);
    };
    // iOS は最初の読み上げがタップの中でないと鳴らないことがあるので、最初のタップで無音の読み上げをしておく
    var unlocked = false;
    addEventListener("touchend", function(){
      if (unlocked) return; unlocked = true;
      try{ var u = new SpeechSynthesisUtterance(" "); u.volume = 0; origSpeak(u); }catch(e){}
    }, {capture:true, passive:true});
  }

  /* ===== 記録の書き出し: iOS は共有シート(「ファイルに保存」など)で渡す ===== */
  if (isIOS && navigator.share && navigator.canShare){
    var blobs = {}, origCreate = URL.createObjectURL;
    URL.createObjectURL = function(b){ var u = origCreate.call(URL, b); try{ if (b instanceof Blob) blobs[u] = b; }catch(e){} return u; };
    var origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function(){
      var b = blobs[this.href];
      if (b && this.download){
        try{
          var f = new File([b], this.download, {type: b.type || "application/json"});
          if (navigator.canShare({files: [f]})){ navigator.share({files: [f]}).catch(function(){}); return; }
        }catch(e){}
      }
      return origClick.call(this);
    };
  }

  /* ===== オフライン対応(https か localhost のときだけ) ===== */
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")){
    addEventListener("load", function(){ navigator.serviceWorker.register("sw.js").catch(function(){}); });
  }
})();
