const DATA = window.APP_DATA;
const LOG_ENDPOINT = (window.LOG_ENDPOINT || DATA.config?.logEndpoint || "").trim();

let state = {
  lang: "ja",
  screen: "language",
  participantId: "",
  email: "",
  consent: false,
  sessionId: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()),
  preSurveyAnswers: {},
  postSurveyAnswers: {},
  introIndex: 0,
  qIndex: 0,
  selected: null,
  score: 0,
  answers: [],
  questionStartedAt: null,
  sessionStartedAt: new Date().toISOString(),
  completedAt: null,
  postSurveyCompletedAt: null,
  error: ""
};

const app = document.getElementById("app");
const t = (key) => DATA.ui[state.lang][key] || key;
const textOf = (obj) => typeof obj === "string" ? obj : obj?.[state.lang] || obj?.ja || "";
const $ = (s) => document.querySelector(s);

function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function csvEscape(v){
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}
function correctValue(q){
  if(q.type === "classify") return Object.entries(q.correct_groups).map(([k,v])=>`${k}:${textOf(v)}`).join("; ");
  if(Array.isArray(q.correct)) return q.correct.join("|");
  return q.correct;
}
function selectedValue(sel){
  if(Array.isArray(sel)) return sel.join("|");
  if(sel && typeof sel === "object") return Object.entries(sel).map(([k,v])=>`${k}:${v}`).join("; ");
  return sel || "";
}
function setScreen(screen){
  state.screen = screen;
  state.error = "";
  render();
  window.scrollTo({top:0, behavior:"smooth"});
}
function layout(content, progressText=""){
  const ui = DATA.ui[state.lang];
  return `
  <main class="site">
    <header class="header">
      <div class="brand">
        <h1>${escapeHtml(ui.appTitle)}</h1>
        <p>${escapeHtml(ui.subtitle)}</p>
      </div>
      ${progressText ? `<div class="badge">${escapeHtml(progressText)}</div>` : ""}
    </header>
    ${content}
    <div class="footer-note">${state.lang === "ja" ? "研究用プロトタイプ：現時点ではCSVダウンロードでログを確認できます。" : "Research prototype: logs can currently be checked by downloading CSV."}</div>
  </main>`;
}
function render(){
  if(state.screen === "language") return renderLanguage();
  if(state.screen === "pre") return renderPreSurvey();
  if(state.screen === "intro") return renderIntro();
  if(state.screen === "question") return renderQuestion();
  if(state.screen === "feedback") return renderFeedback();
  if(state.screen === "result") return renderResult();
  if(state.screen === "post") return renderPostSurvey();
  if(state.screen === "final") return renderFinal();
}

function renderLanguage(){
  app.innerHTML = layout(`
    <section class="card center stack">
      <div class="theme">Bicycle Blue Ticket Simulator 2026</div>
      <h2 class="title">言語を選択してください / Choose your language</h2>
      <p class="notice">${escapeHtml(state.lang === "ja" ? "事前アンケート，シミュレーション，事後アンケートまで同じサイト内で行う仮版です。" : "This prototype includes the pre-survey, simulation, and post-survey in the same site.")}</p>
      <div class="row">
        <button class="btn" onclick="chooseLang('ja')">日本語で開始</button>
        <button class="btn secondary" onclick="chooseLang('en')">Start in English</button>
      </div>
    </section>
  `);
}
function chooseLang(lang){
  state.lang = lang;
  document.documentElement.lang = lang;
  setScreen("pre");
}

function renderSurveyFields(items, answers, prefix=""){
  return items.map((q,idx)=>{
    const value = answers[q.id] || "";
    const name = `${prefix}${q.id}`;
    if(q.type === "single"){
      return `<div class="card"><div class="theme">Q${idx+1}</div><h2 class="title">${escapeHtml(q.title)}</h2>
        ${q.choices.map(c=>`<label class="choice"><input type="radio" name="${name}" value="${escapeHtml(c)}" ${value===c?'checked':''}><span>${escapeHtml(c)}</span></label>`).join("")}
      </div>`;
    }
    if(q.type === "scale"){
      const points = q.points || [1,2,3,4];
      return `<div class="card"><div class="theme">Q${idx+1}</div><h2 class="title">${escapeHtml(q.title)}</h2>
        <div class="scale">
          <div class="row" style="justify-content:space-between"><span class="muted">${escapeHtml(q.min)}</span><span class="muted">${escapeHtml(q.max)}</span></div>
          <div class="scale-options">${points.map(n=>`<label><input type="radio" name="${name}" value="${n}" ${String(value)===String(n)?'checked':''}><span>${n}</span></label>`).join("")}</div>
        </div>
      </div>`;
    }
    if(q.type === "number"){
      const min = q.min ?? "";
      const max = q.max ?? "";
      return `<div class="card"><div class="theme">Q${idx+1}</div><h2 class="title">${escapeHtml(q.title)}</h2>
        <input class="input" type="number" name="${name}" min="${escapeHtml(min)}" max="${escapeHtml(max)}" placeholder="${escapeHtml(q.placeholder || "")}" value="${escapeHtml(value)}" />
      </div>`;
    }
    if(q.type === "multi"){
      const arr = Array.isArray(value) ? value : [];
      return `<div class="card"><div class="theme">Q${idx+1}</div><h2 class="title">${escapeHtml(q.title)}</h2>
        ${q.choices.map(c=>`<label class="choice"><input type="checkbox" name="${name}" value="${escapeHtml(c)}" ${arr.includes(c)?'checked':''}><span>${escapeHtml(c)}</span></label>`).join("")}
        <input class="input" data-other="${name}" placeholder="${escapeHtml(t('otherText'))}" value="${escapeHtml(answers[q.id+'_other']||'')}" />
      </div>`;
    }
    return `<div class="card"><div class="theme">Q${idx+1}</div><h2 class="title">${escapeHtml(q.title)}</h2>
      <textarea class="textarea" name="${name}" placeholder="${q.optional ? (state.lang==='ja'?'任意':'Optional') : ''}">${escapeHtml(value)}</textarea>
    </div>`;
  }).join("");
}
function collectSurvey(formElement, items, answers, prefix=""){
  const form = new FormData(formElement);
  for(const q of items){
    const name = `${prefix}${q.id}`;
    if(q.type === "multi"){
      const vals = form.getAll(name);
      answers[q.id] = vals;
      const other = document.querySelector(`[data-other="${name}"]`)?.value.trim() || "";
      answers[q.id+"_other"] = other;
      if(vals.length === 0 && !q.optional){ state.error = t("required"); return false; }
    }else if(q.type === "number"){
      const val = form.get(name) || "";
      answers[q.id] = val;
      if(!val && !q.optional){ state.error = t("required"); return false; }
      const n = Number(val);
      if(val && (!Number.isFinite(n) || (q.min !== undefined && n < q.min) || (q.max !== undefined && n > q.max))){
        state.error = state.lang === "ja" ? `${q.min}〜${q.max}の範囲で入力してください。` : `Please enter a value between ${q.min} and ${q.max}.`;
        return false;
      }
    }else{
      const val = form.get(name) || "";
      answers[q.id] = val;
      if(!val && !q.optional){ state.error = t("required"); return false; }
    }
  }
  return true;
}
function renderPreSurvey(){
  const survey = DATA.survey[state.lang];
  const fields = renderSurveyFields(survey, state.preSurveyAnswers, "pre_");
  const idHelp = state.lang === "ja"
    ? "本名は入力せず，好きな英字4文字＋数字2桁で入力してください。例：BIKE33，NEKO12，STAR07"
    : "Do not enter your real name. Use four letters and two digits, such as BIKE33, NEKO12, or STAR07.";
  const emailHelp = state.lang === "ja"
    ? "1週間後の追加アンケートに協力できる場合のみ入力してください。入力は任意です。"
    : "Enter your email only if you can cooperate with the follow-up survey one week later. This is optional.";
  const consentText = state.lang === "ja"
    ? "回答内容，正誤，回答時間を研究目的で記録することに同意します。"
    : "I agree that my answers, correctness, and response time may be recorded for research purposes.";
  app.innerHTML = layout(`
    <section class="card">
      <div class="theme">${escapeHtml(t('surveyTitle'))}</div>
      <h2 class="title">${escapeHtml(t('participantId'))}</h2>
      <input id="participant" class="input" placeholder="BIKE33" value="${escapeHtml(state.participantId)}" />
      <p class="notice">${escapeHtml(idHelp)}</p>
      <h2 class="title" style="margin-top:18px">${state.lang === "ja" ? "メールアドレス（任意）" : "Email address (optional)"}</h2>
      <input id="email" class="input" type="email" placeholder="example@example.com" value="${escapeHtml(state.email)}" />
      <p class="notice">${escapeHtml(emailHelp)}</p>
      <label class="choice"><input id="consent" type="checkbox" ${state.consent ? 'checked' : ''}><span>${escapeHtml(consentText)}</span></label>
      ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
    </section>
    <form id="preSurveyForm">${fields}
      <div class="row card"><button type="submit" class="btn">${escapeHtml(t('start'))}</button></div>
    </form>
  `);
  $("#preSurveyForm").addEventListener("submit", submitPreSurvey);
}
function submitPreSurvey(e){
  e.preventDefault();
  state.participantId = $("#participant").value.trim();
  state.email = $("#email").value.trim();
  state.consent = $("#consent").checked;
  if(!state.participantId){ state.error = t("required"); return renderPreSurvey(); }
  if(!/^[A-Za-z]{4}\d{2}$/.test(state.participantId)){
    state.error = state.lang === "ja" ? "参加者IDは英字4文字＋数字2桁で入力してください。例：BIKE33" : "Participant ID must be four letters and two digits, such as BIKE33.";
    return renderPreSurvey();
  }
  if(!state.consent){ state.error = state.lang === "ja" ? "同意欄にチェックしてください。" : "Please check the consent box."; return renderPreSurvey(); }
  if(!collectSurvey(e.target, DATA.survey[state.lang], state.preSurveyAnswers, "pre_")) return renderPreSurvey();
  state.introIndex = 0;
  setScreen("intro");
}

function renderIntro(){
  const card = DATA.introCards[state.introIndex];
  app.innerHTML = layout(`
    <section class="card stack">
      <div class="theme">${escapeHtml(textOf(card.theme))}</div>
      <h2 class="title">${escapeHtml(textOf(card.title))}</h2>
      <p>${escapeHtml(textOf(card.body)).replace(/\n/g,"<br>")}</p>
      <p class="notice">${escapeHtml(textOf(card.hint))}</p>
      <div class="row"><button class="btn" onclick="nextIntro()">${escapeHtml(t('next'))}</button></div>
    </section>
  `, `${state.introIndex+1} / ${DATA.introCards.length}`);
}
function nextIntro(){
  if(state.introIndex < DATA.introCards.length-1){ state.introIndex++; renderIntro(); }
  else { state.qIndex = 0; state.questionStartedAt = new Date().toISOString(); setScreen("question"); }
}

function renderQuestion(){
  const q = DATA.questions[state.qIndex];
  const progress = `${state.qIndex+1} / ${DATA.questions.length}`;
  let inputHtml = "";
  if(q.type === "single"){
    inputHtml = Object.keys(q.choices).map(k=>`<label class="choice"><input type="radio" name="answer" value="${k}"><span><strong>${k}. </strong>${escapeHtml(textOf(q.choices[k]))}</span></label>`).join("");
  } else if(q.type === "multi"){
    inputHtml = Object.keys(q.choices).map(k=>`<label class="choice"><input type="checkbox" name="answer" value="${k}"><span><strong>${k}. </strong>${escapeHtml(textOf(q.choices[k]))}</span></label>`).join("");
  } else if(q.type === "classify"){
    inputHtml = Object.keys(q.choices).map(k=>`
      <div class="choice" style="display:block">
        <p><strong>${k}. </strong>${escapeHtml(textOf(q.choices[k]))}</p>
        <div class="row">${q.groups.map(g=>`<label><input type="radio" name="class_${k}" value="${escapeHtml(g)}"> ${escapeHtml(textOf(g))}</label>`).join("")}</div>
      </div>`).join("");
  }
  app.innerHTML = layout(`
    ${q.image ? `<img class="question-img" src="./assets/${escapeHtml(q.image)}" alt="">` : ""}
    <section class="card">
      <div class="theme">${escapeHtml(textOf(q.theme))}</div>
      <h2 class="title">${escapeHtml(textOf(q.title))}</h2>
      ${q.prelude ? `<p class="prelude">${escapeHtml(textOf(q.prelude))}</p>` : ""}
      <p>${escapeHtml(textOf(q.body))}</p>
      ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
      <form id="qForm">${inputHtml}<div class="row"><button class="btn" type="submit">${escapeHtml(t('submit'))}</button></div></form>
    </section>
  `, progress);
  $("#qForm").addEventListener("submit", submitQuestion);
}
function submitQuestion(e){
  e.preventDefault();
  const q = DATA.questions[state.qIndex];
  const form = new FormData(e.target);
  let selected, isCorrect = false;
  if(q.type === "single"){
    selected = form.get("answer");
    if(!selected){ state.error=t("required"); return renderQuestion(); }
    isCorrect = selected === q.correct;
  } else if(q.type === "multi"){
    selected = form.getAll("answer").sort();
    if(selected.length===0){ state.error=t("required"); return renderQuestion(); }
    isCorrect = JSON.stringify(selected) === JSON.stringify([...q.correct].sort());
  } else if(q.type === "classify"){
    selected = {};
    for(const k of Object.keys(q.choices)){
      const v = form.get(`class_${k}`);
      if(!v){ state.error=t("required"); return renderQuestion(); }
      selected[k] = v;
    }
    isCorrect = Object.keys(q.correct_groups).every(k => selected[k] === q.correct_groups[k]);
  }
  const answeredAt = new Date().toISOString();
  const responseTime = new Date(answeredAt) - new Date(state.questionStartedAt);
  if(isCorrect) state.score++;
  state.selected = selected;
  state.answers.push({
    session_id: state.sessionId,
    participant_id: state.participantId,
    language: state.lang,
    question_id: q.id,
    selected_answer: selectedValue(selected),
    correct_answer: correctValue(q),
    is_correct: isCorrect,
    question_started_at: state.questionStartedAt,
    answered_at: answeredAt,
    response_time_ms: responseTime
  });
  setScreen("feedback");
}
function renderFeedback(){
  const q = DATA.questions[state.qIndex];
  const selected = state.selected;
  const row = state.answers[state.answers.length-1];
  let details = "";
  if(q.type === "classify"){
    details = Object.keys(q.choices).map(k=>{
      const ok = selected[k] === q.correct_groups[k];
      return `<div class="detail-item"><span class="${ok?'good':'bad'}">${ok?'✓':'✗'}</span> <strong>${k}</strong> ${escapeHtml(textOf(q.choices[k]))}<br>
      <span class="muted">${escapeHtml(t('yourAnswer'))}: ${escapeHtml(textOf(selected[k]))} / ${escapeHtml(t('correctAnswer'))}: ${escapeHtml(textOf(q.correct_groups[k]))}</span><br>
      ${escapeHtml(textOf(q.per_choice_feedback[k]))}</div>`;
    }).join("");
  } else {
    const selectedSet = new Set(Array.isArray(selected) ? selected : [selected]);
    const correctSet = new Set(Array.isArray(q.correct) ? q.correct : [q.correct]);
    details = Object.keys(q.choices).map(k=>{
      const picked = selectedSet.has(k), should = correctSet.has(k);
      let mark='・', cls='', status='';
      if(picked && should){mark='✓';cls='good';status= state.lang==='ja'?'選択して正解':'Selected correctly';}
      else if(picked && !should){mark='✗';cls='bad';status= state.lang==='ja'?'選択したが不正解':'Selected but incorrect';}
      else if(!picked && should){mark='△';cls='warn';status= state.lang==='ja'?'選ばなかったが本来は必要':'Should have selected';}
      else {status= state.lang==='ja'?'選ばなくてよい':'Not needed';}
      return `<div class="detail-item"><span class="${cls}">${mark} ${escapeHtml(status)}</span><br><strong>${k}</strong> ${escapeHtml(textOf(q.choices[k]))}<br>${escapeHtml(textOf(q.feedback[k]))}</div>`;
    }).join("");
  }
  const ok = row.is_correct;
  const nextLabel = state.qIndex >= DATA.questions.length-1 ? t("seeResult") : t("next");
  app.innerHTML = layout(`
    <section class="card">
      <div class="${ok?'feedback-ok':'feedback-ng'}">${escapeHtml(ok ? t('correct') : t('review'))}</div>
      <p class="notice">${escapeHtml(textOf(ok ? q.result_ok : q.result_ng))}</p>
      <div class="detail"><h3>${state.lang==='ja'?'各選択肢の整理':'Review of choices'}</h3>${details}</div>
      <div class="row"><button class="btn" onclick="nextQuestion()">${escapeHtml(nextLabel)}</button></div>
    </section>
  `, `${state.score} / ${DATA.questions.length}`);
}
function nextQuestion(){
  if(state.qIndex >= DATA.questions.length-1){
    state.completedAt = new Date().toISOString();
    setScreen("result");
  }else{
    state.qIndex++;
    state.questionStartedAt = new Date().toISOString();
    setScreen("question");
  }
}

function diagnosis(){
  const s = state.score;
  if(state.lang === "ja"){
    if(s>=10) return ["ルール判断マスター型","多くの場面で，交通ルールと安全判断を安定して結びつけられています。"];
    if(s>=7) return ["基本理解型","基本的なルールは理解できていますが，一部の場面判断で迷いが残る可能性があります。"];
    if(s>=4) return ["感覚判断型","危なそうという感覚はありますが，制度上どう扱われるかの整理が必要です。"];
    return ["これから学習型","青切符制度や具体的な場面判断を，これから整理していく段階です。"];
  }
  if(s>=10) return ["Rule Judgment Master","You can connect traffic rules and safe decisions consistently in many situations."];
  if(s>=7) return ["Basic Understanding Type","You understand the basics, but some situation-based decisions may still be confusing."];
  if(s>=4) return ["Intuitive Judgment Type","You may sense danger, but need to organize how each action is handled under the system."];
  return ["Learning Starter","You are at the stage of organizing the blue ticket system and concrete situation-based judgments."];
}
function renderResult(){
  const [type, comment] = diagnosis();
  const totalQuestions = DATA.questions.length;
  const pct = Math.round(state.score / totalQuestions * 100);
  const situationQuestions = DATA.questions.filter(q => q.score_domain === "situation").map(q => q.id);
  const systemQuestions = DATA.questions.filter(q => q.score_domain === "system").map(q => q.id);
  const situationCorrect = state.answers.filter(a => a.is_correct && situationQuestions.includes(a.question_id)).length;
  const systemCorrect = state.answers.filter(a => a.is_correct && systemQuestions.includes(a.question_id)).length;
  const situationScore = situationQuestions.length ? Math.round((situationCorrect / situationQuestions.length) * 100) : 0;
  const systemScore = systemQuestions.length ? Math.round((systemCorrect / systemQuestions.length) * 100) : 0;
  const avgTimeMs = state.answers.length ? Math.round(state.answers.reduce((acc, cur) => acc + Number(cur.response_time_ms || 0), 0) / state.answers.length) : 0;
  const avgTimeSec = (avgTimeMs / 1000).toFixed(1);
  const btnText = state.lang === "ja" ? "事後アンケートへ進む" : "Continue to post-survey";
  app.innerHTML = layout(`
    <section class="card stack">
      <div class="theme">${escapeHtml(t('resultTitle'))}</div>
      <h2 class="title">${escapeHtml(t('score'))}: ${state.score} / ${totalQuestions}</h2>
      <div class="progress"><div style="width:${pct}%"></div></div>
      <div class="result-grid">
        <div class="notice"><strong>${state.lang === "ja" ? "総合正答率" : "Overall accuracy"}</strong><br>${pct}%</div>
        <div class="notice"><strong>${state.lang === "ja" ? "場面判断スコア" : "Situation judgment score"}</strong><br>${situationScore}%</div>
        <div class="notice"><strong>${state.lang === "ja" ? "制度理解スコア" : "System understanding score"}</strong><br>${systemScore}%</div>
        <div class="notice"><strong>${state.lang === "ja" ? "平均回答時間" : "Average response time"}</strong><br>${avgTimeSec}s</div>
      </div>
      <p class="result-type">${escapeHtml(type)}</p>
      <p>${escapeHtml(comment)}</p>
      <p class="notice">${state.lang === "ja" ? "最後に，学習後の意識変化を確認するための簡単な事後アンケートに回答してください。" : "Finally, please answer a short post-survey to check changes after learning."}</p>
      <div class="row"><button class="btn" onclick="setScreen('post')">${escapeHtml(btnText)}</button><button class="btn secondary" onclick="downloadCsv()">${escapeHtml(t('download'))}</button></div>
    </section>
  `, `${state.score} / ${totalQuestions}`);
}

function renderPostSurvey(){
  const survey = DATA.postSurvey[state.lang];
  const fields = renderSurveyFields(survey, state.postSurveyAnswers, "post_");
  app.innerHTML = layout(`
    <section class="card">
      <div class="theme">${state.lang === "ja" ? "事後アンケート" : "Post-survey"}</div>
      <h2 class="title">${state.lang === "ja" ? "学習後の変化について" : "About changes after learning"}</h2>
      <p class="notice">${state.lang === "ja" ? "仮の設問です。後から変更できます。" : "These are provisional questions and can be changed later."}</p>
      ${state.error ? `<p class="error">${escapeHtml(state.error)}</p>` : ""}
    </section>
    <form id="postSurveyForm">${fields}
      <div class="row card"><button type="submit" class="btn">${state.lang === "ja" ? "送信して終了" : "Submit and finish"}</button></div>
    </form>
  `, `${state.score} / ${DATA.questions.length}`);
  $("#postSurveyForm").addEventListener("submit", submitPostSurvey);
}
function submitPostSurvey(e){
  e.preventDefault();
  if(!collectSurvey(e.target, DATA.postSurvey[state.lang], state.postSurveyAnswers, "post_")) return renderPostSurvey();
  state.postSurveyCompletedAt = new Date().toISOString();
  sendCompletionLog().finally(() => setScreen("final"));
}
function followupFormsForParticipant(){
  const forms = DATA.config?.followupForms || {};
  const mode = DATA.config?.followupDeliveryMode || "language";
  if(mode === "both") return Object.entries(forms).filter(([,url]) => url).map(([lang,url]) => ({lang, url}));
  const url = forms[state.lang] || forms.ja || forms.en || "";
  return url ? [{lang: state.lang, url}] : [];
}

function followupEmailPreview(){
  if(!state.email) return null;
  const forms = followupFormsForParticipant();
  const formLines = forms.map(f => `${f.lang.toUpperCase()}: ${f.url}`);
  const subject = state.lang === "ja" ? "自転車青切符シミュレーター 1週間後アンケートのお願い" : "Follow-up survey for the Bicycle Blue Ticket Simulator";
  const choiceInstruction = forms.length > 1
    ? (state.lang === "ja" ? "下記のうち回答しやすい言語のフォームを1つ選んで回答してください。" : "Please choose one form in the language you prefer and answer it.")
    : (state.lang === "ja" ? "下記のフォームに回答してください。" : "Please answer the form below.");
  const body = state.lang === "ja"
    ? `ご協力ありがとうございます。1週間後アンケートにご回答ください。\n${choiceInstruction}\n\n参加者ID: ${state.participantId}\n${formLines.join("\n")}\n\n回答時にも参加者IDを入力してください。`
    : `Thank you for your participation. Please answer the one-week follow-up survey.\n${choiceInstruction}\n\nParticipant ID: ${state.participantId}\n${formLines.join("\n")}\n\nPlease enter this participant ID when answering the form.`;
  return {subject, body, forms};
}

function renderFinal(){
  const emailPreview = followupEmailPreview();
  const follow = state.email
    ? (state.lang === "ja" ? `入力されたメールアドレスへ、1週間後に参加者ID（${state.participantId}）を添えてGoogleフォームの追跡アンケートURLを送付します。` : `A Google Form follow-up survey URL will be sent to the entered email one week later with your participant ID (${state.participantId}).`)
    : (state.lang === "ja" ? "メールアドレスは未入力のため，1週間後アンケートの送付対象にはなりません。" : "No email address was entered, so no follow-up survey will be sent.");
  app.innerHTML = layout(`
    <section class="card stack center">
      <div class="theme">${state.lang === "ja" ? "終了" : "Finished"}</div>
      <h2 class="title">${state.lang === "ja" ? "ご協力ありがとうございました" : "Thank you for your cooperation"}</h2>
      <p>${escapeHtml(follow)}</p>
      ${emailPreview ? `<p class="notice">${escapeHtml(emailPreview.forms.map(f => `${f.lang.toUpperCase()}: ${f.url}`).join(" / "))}</p>` : ""}
      <p class="notice">${state.lang === "ja" ? "ログ送信先が設定されていない場合でも、下のボタンからCSVログをダウンロードできます。" : "Even if no log endpoint is configured, you can download the CSV log using the button below."}</p>
      <div class="row"><button class="btn" onclick="downloadCsv()">${escapeHtml(t('download'))}</button><button class="btn secondary" onclick="location.reload()">${escapeHtml(t('restart'))}</button></div>
    </section>
  `);
}

function buildSummary(){
  const totalQuestions = DATA.questions.length;
  const overall = Math.round((state.score / totalQuestions) * 100);
  const situationIds = DATA.questions.filter(q => q.score_domain === "situation").map(q => q.id);
  const systemIds = DATA.questions.filter(q => q.score_domain === "system").map(q => q.id);
  const situationCorrect = state.answers.filter(a => a.is_correct && situationIds.includes(a.question_id)).length;
  const systemCorrect = state.answers.filter(a => a.is_correct && systemIds.includes(a.question_id)).length;
  return {
    overall_accuracy: overall,
    situation_score: situationIds.length ? Math.round((situationCorrect / situationIds.length) * 100) : 0,
    system_score: systemIds.length ? Math.round((systemCorrect / systemIds.length) * 100) : 0
  };
}

async function sendCompletionLog(){
  if(!LOG_ENDPOINT) return;
  const payload = {
    session_id: state.sessionId,
    participant_id: state.participantId,
    email: state.email,
    language: state.lang,
    session_started_at: state.sessionStartedAt,
    simulation_completed_at: state.completedAt,
    post_survey_completed_at: state.postSurveyCompletedAt,
    followup: {
      requested: Boolean(state.email),
      send_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      delivery_mode: DATA.config?.followupDeliveryMode || "language",
      email_preview: followupEmailPreview()
    },
    summary: buildSummary(),
    pre_survey: state.preSurveyAnswers,
    post_survey: state.postSurveyAnswers,
    answers: state.answers
  };
  try{
    await fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
  }catch(_e){}
}

function downloadCsv(){
  const rows = [];
  rows.push(["section","key","value"]);
  rows.push(["session","session_id",state.sessionId]);
  rows.push(["session","participant_id",state.participantId]);
  rows.push(["session","email",state.email]);
  rows.push(["session","followup_requested",Boolean(state.email)]);
  rows.push(["session","followup_forms",followupFormsForParticipant().map(f=>`${f.lang}:${f.url}`).join("|")]);
  rows.push(["session","language",state.lang]);
  rows.push(["session","started_at",state.sessionStartedAt]);
  rows.push(["session","simulation_completed_at",state.completedAt]);
  rows.push(["session","post_survey_completed_at",state.postSurveyCompletedAt]);
  rows.push(["session","total_score",state.score]);
  for(const [k,v] of Object.entries(state.preSurveyAnswers)) rows.push(["pre_survey",k,Array.isArray(v)?v.join("|"):v]);
  for(const [k,v] of Object.entries(state.postSurveyAnswers)) rows.push(["post_survey",k,Array.isArray(v)?v.join("|"):v]);
  rows.push([]);
  rows.push(["question_id","selected_answer","correct_answer","is_correct","question_started_at","answered_at","response_time_ms"]);
  state.answers.forEach(a=>rows.push([a.question_id,a.selected_answer,a.correct_answer,a.is_correct,a.question_started_at,a.answered_at,a.response_time_ms]));
  const csv = "\ufeff" + rows.map(r=>r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${state.participantId || "participant"}_${new Date().toISOString().replace(/[:.]/g,"-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

render();
