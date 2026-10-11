import assert from "node:assert/strict";
import {expected,plan,sameValue,websiteDNSIntact,CONFIG} from "./apply_spaceship_resend_dns.mjs";
assert.equal(expected.length,4);
assert.deepEqual(expected.map(x=>[x.type,x.name]),[["TXT","resend._domainkey"],["MX","send"],["TXT","send"],["CNAME","rsend"]]);
assert.equal(expected.filter(x=>x.type==="MX").every(x=>x.preference===10),true);
assert.equal(plan([]).changes.length,4,"Absent entries should result in four additions");
assert.equal(plan(expected).changes.length,0,"Exact entries must not be replaced");
assert.equal(plan(expected).already.length,4,"Safe rerun must be idempotent");
assert.equal(plan([{type:"TXT",name:"send",value:"v=spf1 include:other.invalid -all"}]).conflicts.length,1,"Conflicting SPF must block changes");
assert.equal(plan([{type:"CNAME",name:"send",cname:"other.invalid"}]).conflicts.length,2,"Existing CNAME must block MX and TXT");
assert.equal(plan([{type:"TXT",name:"rsend",value:"occupied"}]).conflicts.length,1,"CNAME cannot coexist with TXT");
assert.equal(sameValue({type:"TXT",name:"resend._domainkey",value:expected[0].value},expected[0]),true);
assert.equal(sameValue({type:"TXT",name:"resend._domainkey",value:"different"},expected[0]),false);
assert.equal(websiteDNSIntact({
 root_A:[...CONFIG.preserve.root_A].reverse(),
 www_CNAME:[CONFIG.preserve.www_CNAME+"."],
 nameservers:[...CONFIG.preserve.nameservers].reverse()
}),true);
assert.equal(websiteDNSIntact({root_A:CONFIG.preserve.root_A.slice(1),www_CNAME:[CONFIG.preserve.www_CNAME],nameservers:CONFIG.preserve.nameservers}),false);
assert.equal(websiteDNSIntact({root_A:CONFIG.preserve.root_A,www_CNAME:["other.example.com"],nameservers:CONFIG.preserve.nameservers}),false);
console.log("PASS four-record Resend outbound plan, idempotency, conflict checks, and website preservation");
