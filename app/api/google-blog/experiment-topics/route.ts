import { getExperimentAiAuth } from "@/lib/experiment-ai-auth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 45;
const SCHEMA = {
  type:"object",additionalProperties:false,
  properties:{topics:{type:"array",items:{type:"object",additionalProperties:false,
    properties:{title:{type:"string"},category:{type:"string"},question:{type:"string"}},
    required:["title","category","question"]}}},
  required:["topics"]
} as const;
function norm(value:unknown){return String(value||"").normalize("NFKC").toLowerCase().replace(/[^a-z0-9가-힣]+/g,"");}
export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const old=Array.isArray(body?.existingTitles)?body.existingTitles.filter((v:unknown)=>typeof v==="string").slice(0,120).map((v:string)=>v.slice(0,180)):[];
    const auth=await getExperimentAiAuth();
    if(!auth)return NextResponse.json({error:"AI 연결을 사용할 수 없습니다. Vercel Gateway 또는 OpenAI API 설정을 확인하세요. 직접 주제 붙여넣기는 사용할 수 있습니다."},{status:503});
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),35000);
    let response:Response;
    try{
      response=await fetch(auth.endpoint,{
        method:"POST",
        headers:{"Authorization":"Bearer "+auth.token,"Content-Type":"application/json"},
        body:JSON.stringify({
          model:auth.model,
          instructions:[
            "Generate EXACTLY TEN distinct, practical ideas for a global curiosity blog comparing ChatGPT, Claude and Gemini.",
            "Titles should be natural catchy KOREAN that site owner can understand. Questions must be clear fair ENGLISH and identical across all three models.",
            "Balance 5 evergreen search-interest questions, 3 curiosity/lifestyle topics, and 2 unexpected yet safe questions.",
            "Avoid prior topics and near-duplicates listed by user. Use different subject domains.",
            "These are comparison/recommendation challenges, NOT objective-right-answer quizzes. Where best/number one is subjective, request criteria, strengths, tradeoffs, caveats.",
            "Where rankings or current prices are factual, request named standard, date and sourcing, and do not imply an invented real ranking.",
            "Do not preanswer or invent model responses, winner, prices or rankings. No requests for unsafe or sensitive personal data.",
            "Return only matching JSON with 10 objects (title, category, question).",
          ].join("\n"),
          input:JSON.stringify({date:"2026-10-09",exclude:old}),
          text:{format:{type:"json_schema",name:"comparison_topics",strict:true,schema:SCHEMA}},
          max_output_tokens:3800,store:false
        }),signal:controller.signal,
      });
    }finally{clearTimeout(timeout);}
    if(!response.ok){const details=await response.text();console.error("experiment topics generation failed",auth.provider,response.status,details.slice(0,350));return NextResponse.json({error:"AI 주제 생성 서버 연결 실패: HTTP "+response.status+" / "+auth.provider+". Gateway 활성화 또는 API 키를 확인해 주세요."},{status:502});}
    const result=await response.json();
    const output=typeof result.output_text==="string"?result.output_text:
      Array.isArray(result.output)?result.output.flatMap((v:{content?:Array<{text?:string}>})=>(v.content||[]).map(c=>c.text||"")).join(""):"";
    const parsed=JSON.parse(output) as {topics?:Array<{title?:string;category?:string;question?:string}>};
    const exclude=new Set(old.map(norm)),added=new Set<string>();
    const topics=(Array.isArray(parsed.topics)?parsed.topics:[]).filter(t=>{
      const key=norm(t?.title);
      if(key.length<6||exclude.has(key)||added.has(key)||typeof t.question!=="string"||t.question.trim().length<25)return false;
      added.add(key);return true;
    }).slice(0,10).map(t=>({
      title:String(t.title||"").trim().slice(0,180),
      category:String(t.category||"AI Comparison").trim().slice(0,100),
      question:String(t.question||"").trim().slice(0,1700),
    }));
    if(!topics.length)return NextResponse.json({error:"중복되지 않는 새로운 주제를 만들지 못했습니다. 다시 추천을 눌러주세요."},{status:502});
    return NextResponse.json({topics});
  }catch(e){
    console.error("experiment topic generation",e instanceof Error?e.message:String(e));
    return NextResponse.json({error:"주제를 만들지 못했습니다. 다시 시도하거나 직접 목록을 추가해 주세요."},{status:500});
  }
}
