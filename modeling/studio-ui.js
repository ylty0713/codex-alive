export function setupStudioUI({settings,activity,gesture,hologram}){
 const $=id=>document.getElementById(id);const scene=$('scene-settings'),presence=$('presence-panel');if(scene){$('pane-scene').append(scene);scene.open=true}if(presence){$('pane-presence').append(presence);presence.open=true}
 document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-selected',String(b===button))});for(const pane of document.querySelectorAll('.control-pane'))pane.hidden=pane.id!=='pane-'+button.dataset.tab;});
 const current=()=>settings.get();function update(group,key,value){settings.update({[group]:{...current()[group],[key]:value}})}
 const controls=[];
 function slider(parent,group,key,label,min,max,step,suffix=''){const row=document.createElement('label');row.className='slider-row';row.innerHTML=`<span>${label}</span><input type="range" id="${group}-${key}" min="${min}" max="${max}" step="${step}"><output></output>`;$(parent).append(row);const input=row.querySelector('input'),output=row.querySelector('output');const sync=()=>{const value=current()[group]?.[key];input.value=value??min;output.textContent=String(value??min)+suffix};input.oninput=()=>{update(group,key,Number(input.value));sync()};controls.push(sync);sync()}
 function toggle(parent,group,key,label){const row=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.id=group+'-'+key;row.append(input,document.createTextNode(label));$(parent).append(row);input.onchange=()=>update(group,key,input.checked);const sync=()=>input.checked=current()[group]?.[key]!==false;controls.push(sync);sync()}
 $('hologram-controls').innerHTML='<div class="mode-card"><h2>全息投影</h2><p>反馈到来时从下向上显现；安静一段时间后，人物逐渐消散。</p><div id="holo-options"></div></div>';
 toggle('holo-options','hologram','enabled','启用全息出现与自动消散');slider('holo-options','hologram','idleSeconds','闲置等待',10,600,5,' 秒');slider('holo-options','hologram','appear','出现时长',.3,6,.1,' 秒');slider('holo-options','hologram','disappear','消散时长',.3,6,.1,' 秒');slider('holo-options','hologram','strength','投影光感',0,1,.05);slider('holo-options','hologram','scanlines','扫描纹理',0,1,.05);
 for(const [key,label] of [['color','投影颜色'],['background','背景颜色']]){const row=document.createElement('label'),input=document.createElement('input');input.type='color';input.id='hologram-'+key;row.append(document.createTextNode(label),input);$('holo-options').append(row);input.oninput=()=>update('hologram',key,input.value);const sync=()=>input.value=current().hologram?.[key]||'#f2f2f2';controls.push(sync);sync()}
 toggle('motion-controls','motion','enabled','自然微动作');slider('motion-controls','motion','intensity','动作幅度',0,1,.05);slider('motion-controls','motion','frequency','动作频率',0,1,.05);slider('motion-controls','motion','breathing','呼吸起伏',0,1,.05);
 slider('voice-controls','speech','rate','语速',-50,50,1,'%');slider('voice-controls','speech','pitch','音高',-30,30,1,' Hz');slider('voice-controls','speech','volume','音量',0,1,.05);
 window.addEventListener('companion-settings',()=>controls.forEach(sync=>sync()));
 $('reveal').onclick=()=>{activity();hologram.preview(true)};$('dissolve').onclick=()=>{hologram.preview(false);window.desktop?.publish({type:'activity',show:false})};
 document.querySelectorAll('[data-gesture]').forEach(b=>b.onclick=()=>{activity();gesture(b.dataset.gesture)});
 document.querySelectorAll('[data-motion],#blink,#smile,#neutral').forEach(b=>b.addEventListener('click',activity));
 document.querySelector('aside').addEventListener('pointerdown',activity);
 document.querySelector('aside').addEventListener('input',activity);
 document.getElementById('viewport').addEventListener('pointerdown',event=>{if(event.target.tagName==='CANVAS')activity()});
}
