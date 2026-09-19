import{afterEach,describe,expect,it,vi}from"vitest";
import{validateProviderKeys}from"@/lib/providers/validate";

afterEach(()=>vi.unstubAllGlobals());

describe("provider key validation",()=>{
  it("checks the OpenRouter key without running models",async()=>{
    const fetchMock=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({data:{}}),{status:200}));
    vi.stubGlobal("fetch",fetchMock);
    await expect(validateProviderKeys("or-key")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls.map(([url])=>url)).toEqual(["https://openrouter.ai/api/v1/key"]);
  });
});
