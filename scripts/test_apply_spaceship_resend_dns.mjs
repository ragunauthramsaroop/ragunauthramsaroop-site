import assert from "node:assert/strict";
import {expected,plan,sameValue,websiteDNSIntact,CONFIG} from "./apply_spaceship_resend_dns.mjs";
assert.equal(expected.length,5);
assert.deepEqual(expected.map(x=>[x.type,x.name]),[["TXT","resend._domainkey"],["MX","send"],["TXT","send"],["CNAME","rsend"],["MX","@"]]);
assert.equal(expected.filter(x=>x.type==="MX").every(x=>x.preference===10),true);
assert.equal(plan([]).changes.length,5,"Absent entries should result in five additions");
assert.equal(plan(expected).changes.length,0,"Exact entries must not be replaced");
assert.equal(plan(expected).already.length,5,"Safe rerun must be idempotent");
assert.equal(plan([{type:"TXT",name:"send",value:"v=spf1 include:other.invalid -all"}]).conflicts.length,1,"Conflicting SPF must block changes");
assert.equal(plan([{type:"CNAME",name:"send",cname:"other.invalid"}]).conflicts.length,2,"Existing CNAME must block MX and TXT");
assert.equal(plan([{type:"TXT",name:"rsend",value:"occupied"}]).conflicts.length,1,"CNAME cannot coexist with TXT");
assert.equal(plan([{type:"MX",name:"@",exchange:"other.mail.invalid",preference:10}]).conflicts.length,1,"Unexpected apex MX must block inbound changes");
assert.equal(sameValue({type:"TXT",name:"resend._domainkey",value:expected[0].value},expected[0]),true);
assert.equal(sameValue({type:"TXT",name:"resend._domainkey",value:"different"},expected[0]),false);
assert.equal(websiteDNSIntact({
 root_A:[...CONFIG.preserve.root_A].reverse(),
 www_CNAME:[CONFIG.preserve.www_CNAME+"."],
 nameservers:[...CONFIG.preserve.nameservers].reverse()
}),true);
assert.equal(websiteDNSIntact({root_A:CONFIG.preserve.root_A.slice(1),www_CNAME:[CONFIG.preserve.www_CNAME],nameservers:CONFIG.preserve.nameservers}),false);
assert.equal(websiteDNSIntact({root_A:CONFIG.preserve.root_A,www_CNAME:["other.example.com"],nameservers:CONFIG.preserve.nameservers}),false);
console.log("PASS five-record append-only plan, apex MX conflict gate, idempotency, and website preservation");
