const toast=document.querySelector('#toast');let timer;function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('show'),2200)}
function loadLoggedInArtist(){try{const session=JSON.parse(localStorage.getItem('vicom-session'));const database=JSON.parse(localStorage.getItem('vicom-demo-database'));const artist=database?.users?.find((item)=>item.id===session?.userId||item.email===session?.email);if(artist?.name){document.querySelector('#artist-name').textContent=artist.name;document.querySelector('#artist-greeting').textContent=artist.name;document.querySelector('#artist-initials').textContent=artist.name.split(/\s+/).map((part)=>part[0]).join('').slice(0,2).toUpperCase()}}catch(error){}}
loadLoggedInArtist();
document.querySelector('#notification').addEventListener('click',()=>notify('You have 2 unread messages'));
document.querySelector('#help').addEventListener('click',()=>notify('Help center is opening soon'));
document.querySelector('#view-profile').addEventListener('click',()=>notify('Public profile preview is coming soon'));
document.querySelector('#logout').addEventListener('click',()=>{localStorage.removeItem('vicom-session');window.location.href='../Landing%20Page/index.html'});
document.querySelector('#all-commissions').addEventListener('click',()=>notify('Showing your active commission queue'));
document.querySelector('#open-messages').addEventListener('click',()=>notify('Inbox opened'));
document.querySelector('#add-work').addEventListener('click',()=>notify('Portfolio uploader is coming soon'));
document.querySelectorAll('.status-button').forEach(button=>button.addEventListener('click',()=>{button.textContent=button.dataset.status;button.classList.remove('progress-status');button.classList.add('ready-status');notify('Commission status updated')}));
document.querySelector('.mobile-nav').addEventListener('click',()=>notify('Navigation is available on desktop view'));
