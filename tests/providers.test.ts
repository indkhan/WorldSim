import {afterEach,describe,expect,it,vi} from "vitest";
import {decideWithOpenRouter} from "@/lib/providers/openrouter";

afterEach(()=>vi.unstubAllGlobals());

describe("OpenRouter decision provider",()=>{
  it("uses the OpenRouter Decisions contract",async()=>{
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({answers:{action:{type:"choice",choice:"cut_discretionary_spending",confidence:.82}}}),{status:200,headers:{"content-type":"application/json"}}));
    vi.stubGlobal("fetch",fetchMock);

    const decision=await decideWithOpenRouter({actor:"household",situation:"Energy prices rose."},"test-key");

    expect(fetchMock).toHaveBeenCalledOnce();
    const[url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
    expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(init.headers).toMatchObject({Authorization:"Bearer test-key","Content-Type":"application/json"});
    expect(JSON.parse(String(init.body))).toEqual({
      model:"~typesafe/jev-latest",
      state:"Energy prices rose.",
      questions:{action:{
        type:"choice",
        instructions:"Select the most plausible bounded response.",
        criteria:{
          maintain_routine:"maintain routine",
          adapt_consumption:"adapt consumption",
          cut_discretionary_spending:"cut discretionary spending",
          seek_alternatives:"seek alternatives",
        },
      }},
    });
    expect(decision).toMatchObject({action:"cut discretionary spending",confidence:.82});
  });
  it("does not retry rejected credentials",async()=>{
    const fetchMock=vi.fn().mockResolvedValue(new Response("unauthorized",{status:401}));
    vi.stubGlobal("fetch",fetchMock);
    await expect(decideWithOpenRouter({actor:"government",situation:"Test"},"bad-key")).rejects.toThrow("OpenRouter decision request failed (401)");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
