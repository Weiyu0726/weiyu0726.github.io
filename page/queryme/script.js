'use strict';

// Values transcribed from the original QueryMe paper, Table 1.
const methods = ['FRCNN', 'XMF', 'IAG', 'LASO', 'GREAT', 'QueryMe'];
const benchmark = {
  seen: {label:'Seen', description:'Training and test sets share object and affordance categories.', values:[[87.05,33.55,.600,.082],[87.39,33.91,.604,.078],[89.03,34.29,.623,.076],[90.34,34.88,.627,.077],[91.99,38.03,.676,.067],[92.34,39.39,.683,.061]]},
  object: {label:'Unseen object', description:'Object categories held out during training; affordance categories are shared.', values:[[72.20,18.08,.362,.152],[74.61,17.40,.361,.126],[73.03,16.78,.351,.123],[73.32,16.05,.354,.123],[79.57,20.16,.402,.109],[83.03,21.76,.420,.118]]},
  affordance: {label:'Unseen affordance', description:'Affordance categories held out during training; object categories may overlap.', values:[[59.08,7.96,.210,.156],[60.99,8.11,.225,.152],[62.29,8.99,.251,.141],[64.07,8.37,.228,.140],[69.81,12.05,.290,.127],[74.00,13.76,.316,.097]]}
};
document.querySelectorAll('[data-split]').forEach(button => button.addEventListener('click', () => {
  const split = benchmark[button.dataset.split];
  const best = Array.from({length:4}, (_, i) => (i === 3 ? Math.min : Math.max)(...split.values.map(row => row[i])));
  const rows = split.values.map((values, index) => {
    const row = document.createElement('tr');
    if (index === 5) row.className = 'ours';
    const name = document.createElement('th'); name.scope = 'row'; name.textContent = methods[index];
    if (index === 5) { const tag = document.createElement('span'); tag.textContent = 'Ours'; name.append(' ', tag); }
    row.append(name);
    values.forEach((value, i) => { const cell = document.createElement('td'); const text = value.toFixed(i < 2 ? 2 : 3); if (value === best[i]) {const strong = document.createElement('strong');strong.textContent=text;cell.append(strong);} else cell.textContent=text;row.append(cell); });
    return row;
  });
  document.getElementById('results-body').replaceChildren(...rows);
  document.getElementById('results-caption').textContent = 'PIADv2 — ' + split.label;
  document.getElementById('split-description').textContent = split.description;
  document.querySelectorAll('[data-split]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
}));

const dialog=document.getElementById('image-dialog');
let dialogOpener=null;
document.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>{
  dialogOpener=button;
  const source=button.querySelector('img'), preview=document.getElementById('dialog-image');
  preview.src=button.dataset.zoom;preview.alt=source.alt;
  document.getElementById('dialog-label').textContent=button.getAttribute('aria-label').replace(/^Enlarge (the )?/, '');
  dialog.showModal();document.body.style.overflow='hidden';
}));
document.getElementById('close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('close',()=>{document.body.style.overflow='';dialogOpener?.focus();});

document.getElementById('copy-citation').addEventListener('click',async()=>{
  const source=document.getElementById('bibtex'),status=document.getElementById('copy-status');
  try{await navigator.clipboard.writeText(source.textContent);status.textContent='Citation copied to clipboard.';}
  catch{const range=document.createRange();range.selectNodeContents(source);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);status.textContent='Citation selected. Press Ctrl+C (or ⌘C) to copy.';}
});
