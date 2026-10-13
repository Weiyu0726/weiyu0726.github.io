const film = document.querySelector('#project-film');
const chapterButtons = [...document.querySelectorAll('[data-time]')];
chapterButtons.forEach(button => button.addEventListener('click', async () => {
  const seconds = Number(button.dataset.time);
  const seek = () => { film.currentTime = seconds; };
  if (film.readyState >= 1) seek();
  else film.addEventListener('loadedmetadata', seek, {once:true});
  try { await film.play(); } catch { document.querySelector('#video-status').textContent = 'Press the video play button to begin playback.'; }
  film.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
}));
film.addEventListener('timeupdate', () => {
  const current = chapterButtons.findLast(button => film.currentTime >= Number(button.dataset.time));
  chapterButtons.forEach(button => { const active = button === current; button.classList.toggle('active', active); if (active) button.setAttribute('aria-current','true'); else button.removeAttribute('aria-current'); });
});
film.addEventListener('error', () => { document.querySelector('#video-status').classList.remove('sr-only'); document.querySelector('#video-status').textContent = 'The video could not load. Please use Download film to open the MP4 directly.'; });
document.querySelector('#copy-citation').addEventListener('click', async event => {
  const button=event.currentTarget; const citation=document.querySelector('#bibtex').textContent;
  try {
    if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(citation);
    else {const field=document.createElement('textarea');field.value=citation;field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();const copied=document.execCommand('copy');field.remove();if(!copied)throw new Error('Copy unavailable');}
    button.textContent='Copied ✓';document.querySelector('#copy-status').textContent='Citation copied to clipboard.';
    setTimeout(()=>{button.textContent='Copy citation ⧉';},2500);
  } catch { document.querySelector('#copy-status').classList.remove('sr-only'); document.querySelector('#copy-status').textContent='Select and copy the BibTeX text below.'; const range=document.createRange();range.selectNodeContents(document.querySelector('#bibtex'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range); }
});
const modal=document.querySelector('#figure-dialog');
document.querySelectorAll('[data-image]').forEach(button=>button.addEventListener('click',()=>{const img=document.querySelector('#large-figure');img.src=button.dataset.image;img.alt=button.dataset.caption;document.querySelector('#figure-caption').textContent=button.dataset.caption;modal.showModal();}));
document.querySelector('#close-figure').addEventListener('click',()=>modal.close());
modal.addEventListener('click',event=>{if(event.target===modal){const rect=modal.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)modal.close();}});
