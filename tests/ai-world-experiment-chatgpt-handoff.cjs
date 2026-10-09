const test=require("node:test");
const assert=require("node:assert/strict");
const funcs=import("../lib/ai-world-experiment-chatgpt-handoff.mjs");
const answers={chatgpt:{response:"I recommend Switzerland for overall quality of life."},
 claude:{response:"My pick is Denmark, considering welfare."},
 gemini:{response:"I would choose Finland for education."}};
const draft={
 title:"3 AIs Choose the Best Country",metaDescription:"ChatGPT Claude and Gemini choose different countries.",
 labels:["AI Comparison","Travel"],html:"<h2>3 AI Recommendations</h2>"+("<p>The three assistants compared evidence, tradeoffs, quality of life and the meaning of best.</p>").repeat(10),
 scores:[
  {provider:"chatgpt",finalAnswer:"Switzerland",verdict:"recommendation",evidence:"I recommend Switzerland",explanation:"선정 이유"},
  {provider:"claude",finalAnswer:"Denmark",verdict:"recommendation",evidence:"My pick is Denmark",explanation:"선정 이유"},
  {provider:"gemini",finalAnswer:"Finland",verdict:"recommendation",evidence:"I would choose Finland",explanation:"선정 이유"}
 ],
 needsReview:[],ready:true,humanVerdict:"not_recorded"
};
test("free ChatGPT article prompt includes all three raw responses and no API token request",async()=>{
 const {buildChatGptArticlePrompt}=await funcs;
 const prompt=buildChatGptArticlePrompt({mode:"recommend",title:"best country",testQuestion:"Name one best country",runs:answers});
 assert.match(prompt,/I recommend Switzerland/);
 assert.match(prompt,/My pick is Denmark/);
 assert.match(prompt,/I would choose Finland/);
 assert.match(prompt,/There is no universal right answer or winner/);
 assert.doesNotMatch(prompt,/OPENAI_API_KEY|AI_GATEWAY_API_KEY|sk-proj-/);
});
test("quiz prompt requires original PDF manually attached and keeps original answer private until final editorial",async()=>{
 const {buildChatGptArticlePrompt}=await funcs;
 const prompt=buildChatGptArticlePrompt({mode:"quiz",fixtureMode:"pdf",pdf:{name:"test.pdf",sha256:"abc123"},title:"receipt",groundTruth:"Singapore",runs:answers});
 assert.match(prompt,/Manually attach the exact original PDF/);
 assert.match(prompt,/PRECOMMITTED private answer key/);
 assert.match(prompt,/Singapore/);
});
test("exact quote checks allow importing ready recommendation blog result",async()=>{
 const {parseChatGptDraft}=await funcs;
 const out=parseChatGptDraft("[WORLD_BLOG_DRAFT_JSON]\n"+JSON.stringify(draft)+"\n[/WORLD_BLOG_DRAFT_JSON]",answers,"recommend");
 assert.equal(out.error,"");
 assert.equal(out.draft?.scores.length,3);
 assert.equal(out.draft?.ready,true);
});
test("fabricated quote and uncertain verdict result in user-facing review required",async()=>{
 const {parseChatGptDraft}=await funcs;
 const bad=JSON.parse(JSON.stringify(draft));
 bad.scores[1].evidence="fabricated Denmark proof";
 bad.scores[2].verdict="uncertain";
 const out=parseChatGptDraft(JSON.stringify(bad),answers,"recommend");
 assert.equal(out.draft.ready,false);
 assert.ok(out.draft.needsReview.some(v=>v.includes("claude")));
 assert.ok(out.draft.needsReview.some(v=>v.includes("gemini")));
});
test("unsafe HTML is rejected",async()=>{
 const {parseChatGptDraft}=await funcs;
 const bad={...draft,html:"<script>alert(1)</script>"};
 assert.equal(parseChatGptDraft(JSON.stringify(bad),answers,"recommend").draft,null);
});
test("topic replenishment prompt includes old topics and asks for exactly ten plain Korean titles",async()=>{
 const {buildChatGptTopicPrompt}=await funcs;
 const prompt=buildChatGptTopicPrompt(["best smartphones","best laptop"]);
 assert.match(prompt,/10개/);
 assert.match(prompt,/best smartphones/);
 assert.match(prompt,/번호, 설명/);
});
