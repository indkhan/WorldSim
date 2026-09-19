import {afterEach,describe,expect,it,vi} from "vitest";
import {decideWithJev} from "@/lib/providers/jev";

afterEach(()=>vi.unstubAllGlobals());

describe("Jev provider",()=>{
  it("uses the System One choice contract",async()=>{
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({answers:{action:{choice:"cut_discretionary_spending",confidence:.82}}}),{status:200,headers:{"content-type":"application/json"}}));
    vi.stubGlobal("fetch",fetchMock);

    const decision=await decideWithJev({actor:"household",situation:"Energy prices rose."},{apiKey:"test-key"});

    expect(fetchMock).toHaveBeenCalledOnce();
    const[url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init.headers).toMatchObject({Authorization:"Bearer test-key","content-type":"application/json"});
    expect(JSON.parse(String(init.body))).toEqual({
      model:"jev-latest",
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
});
