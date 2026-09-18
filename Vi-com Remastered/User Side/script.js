const chips = document.querySelectorAll('.chip');
const artistGrid = document.querySelector('#artist-grid');
const search = document.querySelector('#search-input');
const empty = document.querySelector('#empty-state');
const toast = document.querySelector('#toast');
let timer;
let cards = [];
let uploadedArtists = [];

function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('show'),2200)}

function loadLoggedInUser(){try{const session=JSON.parse(localStorage.getItem('vicom-session'));const database=JSON.parse(localStorage.getItem('vicom-demo-database'));const user=database?.users?.find((item)=>item.id===session?.userId||item.email===session?.email);if(user?.name){document.querySelector('#user-name').textContent=`${user.name}.`;document.querySelector('#profile-initials').textContent=user.name.split(/\s+/).map((part)=>part[0]).join('').slice(0,2).toUpperCase()}}catch(error){}}

async function getUploadedArtists(){
	try{
		const response=await fetch('../Account%20functions/api.php?action=artworks');
		if(!response.ok)throw new Error('Artwork API unavailable');
		const result=await response.json();
		if(Array.isArray(result.artworks)&&result.artworks.length)return result.artworks;
		throw new Error('No database artwork found');
	}catch(error){
		try{
			const database=JSON.parse(localStorage.getItem('vicom-demo-database'))||{};
			const legacy=JSON.parse(localStorage.getItem('vicom-portfolio'))||[];
			return Array.isArray(database.artworks)&&database.artworks.length?database.artworks:legacy;
		}catch(fallbackError){return []}
	}
}

function artistStyle(category){
	const value=String(category||'').toLowerCase();
	if(value.includes('portrait'))return 'portrait';
	if(value.includes('illustration'))return 'illustration';
	if(value.includes('tattoo'))return 'tattoo';
	if(value.includes('painting'))return 'painting';
	return 'brand';
}

function normalizeArtwork(work){
	return {
		...work,
		artistId:work.artistId||work.artist_id||'',
		artist:work.artist||work.artistName||'Unknown artist',
		category:work.category||'Original artwork'
	};
}

function renderUploadedArtists(artworks){
	uploadedArtists=artworks.map(normalizeArtwork).filter((work)=>work.artistId).slice(0,3);
	artistGrid.innerHTML=uploadedArtists.map((work)=>`<article class="artist-card" data-style="${artistStyle(work.category)}" data-name="${work.artist.toLowerCase()}" data-artist-id="${work.artistId}"><div class="artist-photo" style="background-image:url('${work.image}')"><a class="artist-photo-link" href="../User Side/artist.html?id=${encodeURIComponent(work.artistId)}" aria-label="View ${work.artist} profile"></a><button class="save" aria-label="Save ${work.artist}">♡</button></div><div class="artist-info"><div><h3>${work.artist}</h3><p>${work.category} · ${work.detail||'Original artwork'}</p></div><strong>from ${work.price}</strong></div></article>`).join('');
	cards=[...artistGrid.querySelectorAll('.artist-card')];
	artistGrid.querySelectorAll('.save').forEach((button)=>button.addEventListener('click',()=>{button.classList.toggle('saved');button.textContent=button.classList.contains('saved')?'♥':'♡';notify(button.classList.contains('saved')?'Artist saved':'Artist removed')}));
	filterArtists();
}

loadLoggedInUser();
function filterArtists(){const term=search.value.toLowerCase();const style=document.querySelector('.chip.active').dataset.style;let count=0;cards.forEach(card=>{const matchStyle=style==='all'||card.dataset.style===style;const matchText=card.dataset.name.includes(term);const show=matchStyle&&matchText;card.classList.toggle('hidden',!show);if(show)count++});empty.style.display=count?'none':'block'}
chips.forEach(chip=>chip.addEventListener('click',()=>{chips.forEach(item=>item.classList.remove('active'));chip.classList.add('active');filterArtists()}));search.addEventListener('input',filterArtists);
document.querySelector('#bell').addEventListener('click',()=>notify('You are all caught up'));
document.querySelector('#logout').addEventListener('click',()=>{localStorage.removeItem('vicom-session');window.location.href='../LandingPage/index.html'});
document.querySelector('#filter-button').addEventListener('click',()=>notify('More filters are coming soon'));
const modal=document.querySelector('#brief-modal');document.querySelector('#brief-button').addEventListener('click',()=>{modal.classList.add('open');modal.setAttribute('aria-hidden','false')});document.querySelector('#close-modal').addEventListener('click',()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true')});document.querySelector('#submit-brief').addEventListener('click',()=>{modal.classList.remove('open');notify('Your brief has been saved')});
getUploadedArtists().then(renderUploadedArtists);
