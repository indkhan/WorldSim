import{afterEach,describe,expect,it,vi}from"vitest";
import{validateProviderKeys}from"@/lib/providers/validate";

afterEach(()=>vi.unstubAllGlobals());

describe("provider key validation",()=>{
  it("checks both keys without running models",async()=>{
    const fetchMock=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({models:[]}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({data:{}}),{status:200}));
    vi.stubGlobal("fetch",fetchMock);
    await expect(validateProviderKeys({jev:"jev-key",openrouter:"or-key"})).resolves.toBeUndefined();
    expect(fetchMock.mock.calls.map(([url])=>url)).toEqual(["https://api.typesafe.ai/v1/models","https://openrouter.ai/api/v1/key"]);
  });
});
