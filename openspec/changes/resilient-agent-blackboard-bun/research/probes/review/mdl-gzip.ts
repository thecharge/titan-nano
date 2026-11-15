const enc=(s:string)=>new TextEncoder().encode(s);
const L=(s:string)=>Bun.gzipSync(enc(s),{level:9}).length;
const D="PASS test_a\nPASS test_b\n".repeat(200), H="export const f=(x:number)=>x*2;\n";
const total=L(H)+(L(H+D)-L(H));
console.log("Bun",Bun.version,"L(D)=",L(D),"L(H)=",L(H),"L(H+D)-L(H)=",L(H+D)-L(H),"cr=",(L(D)/total).toFixed(3));
