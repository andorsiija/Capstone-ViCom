const chips = document.querySelectorAll('.chip');
const cards = document.querySelectorAll('.artist-card');
const search = document.querySelector('#search-input');
const empty = document.querySelector('#empty-state');
const toast = document.querySelector('#toast');
let timer;
function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('show'),2200)}
function filterArtists(){const term=search.value.toLowerCase();const style=document.querySelector('.chip.active').dataset.style;let count=0;cards.forEach(card=>{const matchStyle=style==='all'||card.dataset.style===style;const matchText=card.dataset.name.toLowerCase().includes(term);const show=matchStyle&&matchText;card.classList.toggle('hidden',!show);if(show)count++});empty.style.display=count?'none':'block'}
chips.forEach(chip=>chip.addEventListener('click',()=>{chips.forEach(item=>item.classList.remove('active'));chip.classList.add('active');filterArtists()}));search.addEventListener('input',filterArtists);
document.querySelectorAll('.save').forEach(button=>button.addEventListener('click',()=>{button.classList.toggle('saved');button.textContent=button.classList.contains('saved')?'♥':'♡';notify(button.classList.contains('saved')?'Artist saved':'Artist removed')}));
document.querySelector('#bell').addEventListener('click',()=>notify('You are all caught up'));
document.querySelector('#filter-button').addEventListener('click',()=>notify('More filters are coming soon'));
const modal=document.querySelector('#brief-modal');document.querySelector('#brief-button').addEventListener('click',()=>{modal.classList.add('open');modal.setAttribute('aria-hidden','false')});document.querySelector('#close-modal').addEventListener('click',()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true')});document.querySelector('#submit-brief').addEventListener('click',()=>{modal.classList.remove('open');notify('Your brief has been saved')});
