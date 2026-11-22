/* Original Manykiln browser UI. MIT. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const examples=[
    {name:'Shared stable range',input:{dependencies:[{name:'web-client',range:'^1.2.0'},{name:'build-plugin',range:'~1.4.2'}],versions:['1.2.0','1.4.1','1.4.2','1.4.9','1.5.0','2.0.0']}},
    {name:'Exact pair conflict',input:{dependencies:[{name:'legacy-adapter',range:'^1.4.0'},{name:'new-adapter',range:'>=2.0.0 <3.0.0'}],versions:['1.4.0','1.9.0','2.0.0','2.1.0']}},
    {name:'Available set gap',input:{dependencies:[{name:'renderer',range:'^3.0.0'},{name:'test-runner',range:'~3.2.0'}],versions:['3.0.0','3.1.0','4.0.0']}},
    {name:'Higher-order conflict',input:{dependencies:[{name:'alpha',range:'1.0.0 || 2.0.0'},{name:'beta',range:'2.0.0 || 3.0.0'},{name:'gamma',range:'1.0.0 || 3.0.0'}],versions:['1.0.0','2.0.0','3.0.0']}}
  ];
  let report=null;
  function invalidate(message='Input changed. Run inspection to refresh the report.'){
    report=null;$('export').disabled=true;$('result').hidden=true;$('rows').replaceChildren();$('head').replaceChildren();$('json').textContent='';$('summary').textContent='';$('findings').replaceChildren();$('status').textContent=message;$('status').dataset.tone='neutral';
  }
  function load(i){invalidate('Fictional example loaded. Run inspection.');$('input').value=JSON.stringify(examples[i].input,null,2);}
  examples.forEach((e,i)=>{const b=document.createElement('button');b.type='button';b.textContent=e.name;b.addEventListener('click',()=>load(i));$('examples').append(b);});
  $('input').addEventListener('input',()=>invalidate());
  $('clear').addEventListener('click',()=>{$('input').value='';invalidate('Cleared. Paste dependency constraints and an available version set.');});
  $('run').addEventListener('click',()=>{
    invalidate('Inspecting locally…');
    try{
      if(!$('input').value.trim()) throw Error('Missing input.');
      if($('input').value.length>100000) throw Error('Input exceeds 100000 characters.');
      let input;try{input=JSON.parse($('input').value);}catch{throw Error('Input is not valid JSON.');}
      report=SemVerMatrix.inspect(input);
      $('json').textContent=JSON.stringify(report,null,2);
      for(const name of ['Available version',...report.dependencies.map(d=>d.name),'All constraints']){const th=document.createElement('th');th.scope='col';th.textContent=name;$('head').append(th);}
      for(const row of report.matrix){const tr=document.createElement('tr');for(const v of [row.version,...row.matches.map(x=>x?'Match':'—'),row.satisfiesAll?'YES':'No']){const td=document.createElement('td');td.textContent=v;tr.append(td);}$('rows').append(tr);}
      $('summary').textContent='Minimum possible: '+(report.minimumPossible??'none')+' · Minimum available: '+(report.minimumAvailable??'none')+' · Exact conflict pairs: '+report.conflictPairs.length+' · Available-set pair gaps: '+report.coverageGaps.length+(report.higherOrderConflict?' · Higher-order conflict: every pair overlaps, but all constraints cannot coexist.':'');
      for(const pair of report.conflictPairs){const li=document.createElement('li');li.textContent='Exact conflict: '+pair.left+' ('+pair.leftRange+') and '+pair.right+' ('+pair.rightRange+'). No shared version exists.';$('findings').append(li);}
      for(const pair of report.coverageGaps){const li=document.createElement('li');li.textContent='Available-set gap: '+pair.left+' and '+pair.right+' overlap from '+pair.minimumWitness+', but no supplied version fits both.';$('findings').append(li);}
      if(report.higherOrderConflict){const li=document.createElement('li');li.textContent='Every pair overlaps, but no version satisfies all consumers. Review the OR alternatives together.';$('findings').append(li);}
      $('status').textContent=report.compatible?(report.minimumAvailable?'COMPATIBLE · shared available version found':'COVERAGE GAP · ranges overlap, supplied versions do not'):'CONFLICT · no version satisfies all ranges';
      $('status').dataset.tone=report.minimumAvailable?'good':'bad';$('result').hidden=false;$('export').disabled=false;
    }catch(error){invalidate('BLOCKED: '+error.message);$('status').dataset.tone='bad';}
  });
  $('export').addEventListener('click',()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='semvermatrix-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  load(0);
})();
