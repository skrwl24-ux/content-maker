export const BASELINE_PROFILE = Object.freeze({
  id:"basic-free-chat-v1",
  title:"무료/기본 채팅 우선 · PDF 동일 · 외부 검색·심층 모드 제외",
  commonInstruction:"Use only the attached test material and your own general knowledge. Do not browse the web, run deep research, invoke external apps, or use additional search services. Answer in a normal chat response. If the PDF cannot be read, say so. Do not guess missing pages.",
});
const HINTS={
  chatgpt:{
    service:"ChatGPT",
    steps:["Free/guest account if file attachment works; otherwise disclose your actual plan.", "Start a NEW chat. When available, choose a non-personalized temporary chat.", "Keep the ordinary/Instant chat mode; do not activate Think, Work or deep research.", "Do not enable web search or connected apps. Attach the original PDF."],
  },
  claude:{
    service:"Claude",
    steps:["Use the Free tier when available, or record the actual paid tier.", "Start a NEW ordinary chat and leave the model at the basic default shown in the interface.", "Use Default rather than Research; turn extended thinking/extra effort and web search off when the controls are available.", "Avoid connectors. Attach the original PDF."],
  },
  gemini:{
    service:"Gemini",
    steps:["Use Gemini without a paid AI plan when available, or record the plan actually used.", "Start a NEW chat, choose the normal/default model and standard thinking if selectable.", "Do not activate Deep Research, Deep Think or optional connected apps.", "Ask Gemini to use only the PDF; if web grounding/search still occurs, record that instead of claiming it was disabled."],
  },
};
export function getProviderBaselineHint(id){return HINTS[id]||null;}
export function baselineStatus(run={}){
 const plan=run.accountPlan||"";
 const normal=run.chatMode==="standard";
 const noSearch=run.webUsed==="no";
 const noExtras=run.extraToolsUsed==="no";
 const fresh=run.newChat===true;
 const modelKnown=Boolean(String(run.model||"").trim());
 const complete=Boolean(plan && normal && noSearch && noExtras && fresh && modelKnown);
 const deviations=[];
 if(plan==="paid") deviations.push("paid plan");
 if(run.chatMode==="advanced") deviations.push("advanced reasoning/research mode");
 if(run.webUsed==="yes") deviations.push("web search used");
 if(run.extraToolsUsed==="yes") deviations.push("extra tools used");
 if(!fresh && (run.response||"").trim()) deviations.push("fresh chat not confirmed");
 return {
  protocol:"basic-free-chat-v1",
  complete,
  strictFreeBaseline:complete && (plan==="free" || plan==="guest"),
  deviations,
  label:complete && (plan==="free"||plan==="guest") ? "free/basic confirmed" :
    deviations.length ? "comparison setting differs" : "setup not yet fully verified",
 };
}
