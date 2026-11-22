/* Original Manykiln implementation. MIT. Pure deterministic SemVer inspection. */
(function(root,factory){
  if(typeof module==='object' && module.exports) module.exports=factory();
  else root.SemVerMatrix=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const LIMITS=Object.freeze({dependencies:16,versions:300,range:1000,clauses:8,comparators:16,search:20000});
  function fail(message){throw new Error(message);}
  function parseVersion(text){
    if(typeof text!=='string' || text.length>256) fail('Version must be a string of at most 256 characters.');
    const m=text.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/);
    if(!m) fail('Invalid full SemVer version.');
    const pre=m[4]?m[4].split('.'):[];
    if(pre.some(x=>/^\d+$/.test(x) && x.length>1 && x[0]==='0')) fail('Numeric prerelease identifiers cannot have leading zeroes.');
    return {major:BigInt(m[1]),minor:BigInt(m[2]),patch:BigInt(m[3]),pre,build:m[5]||''};
  }
  function format(v){return `${v.major}.${v.minor}.${v.patch}`+(v.pre.length?'-'+v.pre.join('.'):'')+(v.build?'+'+v.build:'');}
  function tuple(v){return `${v.major}.${v.minor}.${v.patch}`;}
  function cmp(a,b){
    if(typeof a==='string') a=parseVersion(a);if(typeof b==='string') b=parseVersion(b);
    for(const k of ['major','minor','patch']) if(a[k]!==b[k]) return a[k]<b[k]?-1:1;
    if(!a.pre.length || !b.pre.length) return a.pre.length===b.pre.length?0:a.pre.length?-1:1;
    for(let i=0;i<Math.max(a.pre.length,b.pre.length);i++){
      const x=a.pre[i],y=b.pre[i];
      if(x===undefined || y===undefined) return x===y?0:x===undefined?-1:1;
      if(x===y) continue;
      const nx=/^\d+$/.test(x),ny=/^\d+$/.test(y);
      if(nx && ny) return x.length===y.length?(x<y?-1:1):(x.length<y.length?-1:1);
      if(nx!==ny) return nx?-1:1;
      return x<y?-1:1;
    }
    return 0;
  }
  function ver(major,minor=0n,patch=0n,pre=[]){return {major,minor,patch,pre,build:''};}
  function partial(text){
    if(text.length>256) fail('Range version must be at most 256 characters.');
    if(text.includes('-') || text.includes('+')) {const v=parseVersion(text);return {...v,count:3};}
    const parts=text.split('.');
    if(parts.length>3 || !parts.length) fail('Invalid range version.');
    let wildcard=false,count=0;const nums=[];
    for(const p of parts){
      if(/^(?:x|X|\*)$/.test(p)) {wildcard=true;nums.push(0n);}
      else {
        if(wildcard || !/^(?:0|[1-9]\d*)$/.test(p)) fail('Invalid partial version or wildcard order.');
        nums.push(BigInt(p));count++;
      }
    }
    return {...ver(nums[0]||0n,nums[1]||0n,nums[2]||0n),count};
  }
  function upperPartial(v){return v.count===1?ver(v.major+1n,0n,0n,['0']):ver(v.major,v.minor+1n,0n,['0']);}
  function expand(op,text){
    const v=partial(text), c=(operator,version)=>({op:operator,v:version});
    if(v.count===0){if(['','=', '^','~','>=','<='].includes(op)) return [];fail('Strict comparator with a wildcard has no supported bound.');}
    if(op==='^'){
      let upper;
      if(v.major>0n || v.count===1) upper=ver(v.major+1n,0n,0n,['0']);
      else if(v.minor>0n || v.count===2) upper=ver(0n,v.minor+1n,0n,['0']);
      else upper=ver(0n,0n,v.patch+1n,['0']);
      return [c('>=',v),c('<',upper)];
    }
    if(op==='~') return [c('>=',v),c('<',v.count===1?ver(v.major+1n,0n,0n,['0']):ver(v.major,v.minor+1n,0n,['0']))];
    if(v.count<3){
      if(op==='' || op==='=') return [c('>=',v),c('<',upperPartial(v))];
      if(op==='>=') return [c('>=',v)];
      if(op==='>') {const u=upperPartial(v);return [c('>=',ver(u.major,u.minor,u.patch))];}
      if(op==='<') return [c('<',ver(v.major,v.minor,v.patch,['0']))];
      if(op==='<=') return [c('<',upperPartial(v))];
    }
    return [c(op||'=',v)];
  }
  function parseRange(text){
    if(typeof text!=='string' || !text.trim() || text.length>LIMITS.range) fail('Range needs 1..1000 characters; use * for any stable release.');
    const parts=text.trim().split('||');
    if(parts.length>LIMITS.clauses || parts.some(p=>!p.trim())) fail('Range needs 1..8 nonempty OR clauses.');
    return parts.map(part=>{
      if(/[(),]/.test(part) || /\s-\s/.test(part)) fail('Hyphen ranges, commas and parentheses are unsupported; use comparators.');
      const tokens=part.trim().replace(/(>=|<=|>|<|=|\^|~)\s+/g,'$1').split(/\s+/);
      if(tokens.length>LIMITS.comparators) fail('At most 16 terms per OR clause.');
      const comps=[],gate=new Set();
      for(const token of tokens){
        const m=token.match(/^(\^|~|>=|<=|>|<|=)?(.+)$/);
        if(!m) fail('Invalid range term.');
        // Only explicitly supplied prereleases open the comparator-set gate.
        const p=partial(m[2]);if(p.pre.length) gate.add(tuple(p));
        comps.push(...expand(m[1]||'',m[2]));
      }
      return {comps,gate};
    });
  }
  function satisfiesClause(v,clause){
    if(v.pre.length && !clause.gate.has(tuple(v))) return false;
    return clause.comps.every(c=>{
      const n=cmp(v,c.v);
      return c.op==='='?n===0:c.op==='>'?n>0:c.op==='>='?n>=0:c.op==='<'?n<0:n<=0;
    });
  }
  function satisfies(version,range){
    const v=typeof version==='string'?parseVersion(version):version;
    const clauses=typeof range==='string'?parseRange(range):range;
    return clauses.some(c=>satisfiesClause(v,c));
  }
  function combine(a,b){return {comps:[...a.comps,...b.comps],gate:new Set([...a.gate].filter(t=>b.gate.has(t)))};}
  function minimumClause(clause){
    let lower=ver(0n,0n,0n,['0']),strict=false;
    for(const c of clause.comps) if(['=','>','>='].includes(c.op)){
      const n=cmp(c.v,lower);
      if(n>0){lower=c.v;strict=c.op==='>';}
      else if(n===0 && c.op==='>') strict=true;
    }
    const stable=lower.pre.length?ver(lower.major,lower.minor,lower.patch):strict?ver(lower.major,lower.minor,lower.patch+1n):ver(lower.major,lower.minor,lower.patch);
    const candidates=[stable];
    for(const key of clause.gate){
      const [a,b,c]=key.split('.').map(BigInt);let v=ver(a,b,c,['0']);
      const n=cmp(v,lower);
      if(n<0) v={...lower,pre:lower.pre.slice(),build:''};
      if(cmp(v,lower)===0 && strict) v={...v,pre:[...v.pre,'0']};
      if(tuple(v)===key && v.pre.length) candidates.push(v);
    }
    const valid=candidates.filter(v=>satisfiesClause(v,clause)).sort(cmp);
    return valid[0]||null;
  }
  function minimum(ranges){
    if(!Array.isArray(ranges) || !ranges.length) fail('At least one range is required.');
    const parsed=ranges.map(r=>typeof r==='string'?parseRange(r):r);
    let visits=0,best=null;
    function walk(index,current){
      for(const clause of parsed[index]){
        if(++visits>LIMITS.search) fail('Range intersection exceeds deterministic search limit; reduce OR clauses.');
        const merged=current?combine(current,clause):clause, witness=minimumClause(merged);
        if(!witness) continue;
        if(index===parsed.length-1){if(!best || cmp(witness,best)<0) best=witness;}
        else walk(index+1,merged);
      }
    }
    walk(0,null);return best?format(best):null;
  }
  function inspect(input){
    if(!input || typeof input!=='object' || Array.isArray(input)) fail('Input must be an object.');
    if(Object.keys(input).some(k=>!['dependencies','versions'].includes(k))) fail('Unsupported input field.');
    if(!Array.isArray(input.dependencies) || !input.dependencies.length || input.dependencies.length>LIMITS.dependencies) fail('Provide 1..16 dependency constraints on one shared package.');
    if(!Array.isArray(input.versions) || !input.versions.length || input.versions.length>LIMITS.versions) fail('Provide 1..300 full available versions.');
    const seen=new Set();
    const deps=input.dependencies.map(d=>{
      if(!d || typeof d!=='object' || Array.isArray(d) || Object.keys(d).some(k=>!['name','range'].includes(k)) || typeof d.name!=='string' || !d.name.trim() || d.name.length>100 || seen.has(d.name)) fail('Dependencies need unique nonempty names (at most 100 characters) and ranges.');
      seen.add(d.name);return {name:d.name,range:d.range,parsed:parseRange(d.range)};
    });
    const versions=[...new Set(input.versions)].map(raw=>({raw,v:parseVersion(raw)})).sort((a,b)=>cmp(a.v,b.v)||(a.raw<b.raw?-1:a.raw>b.raw?1:0));
    const matrix=versions.map(({raw,v})=>({version:raw,matches:deps.map(d=>satisfies(v,d.parsed)),satisfiesAll:deps.every(d=>satisfies(v,d.parsed))}));
    const min=minimum(deps.map(d=>d.parsed)), conflictPairs=[],coverageGaps=[];
    for(let i=0;i<deps.length;i++) for(let j=i+1;j<deps.length;j++){
      const witness=minimum([deps[i].parsed,deps[j].parsed]);
      const pair={left:deps[i].name,right:deps[j].name,leftRange:deps[i].range,rightRange:deps[j].range,minimumWitness:witness};
      if(witness===null) conflictPairs.push(pair);
      else if(!matrix.some(row=>row.matches[i] && row.matches[j])) coverageGaps.push(pair);
    }
    const available=matrix.filter(row=>row.satisfiesAll).map(row=>row.version);
    return {tool:'SemVerMatrix',compatible:min!==null,minimumPossible:min,minimumAvailable:available[0]||null,satisfyingAvailable:available,dependencies:deps.map(d=>({name:d.name,range:d.range,minimumPossible:minimum([d.parsed])})),matrix,conflictPairs,coverageGaps,higherOrderConflict:deps.length>=3 && min===null && conflictPairs.length===0,notice:'All constraints refer to one shared package. Exact conflicts use range intersection; coverage gaps refer only to the supplied version set. Prereleases need explicit same-tuple admission in every chosen OR clause. No registry lookup or lockfile resolution.'};
  }
  return Object.freeze({LIMITS,parseVersion,compare:cmp,parseRange,satisfies,minimum,inspect});
});
