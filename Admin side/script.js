const toast=document.querySelector('#toast');let timer;function notify(message){toast.textContent=message;toast.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('show'),2200)}
document.querySelector('#notification').addEventListener('click',()=>notify('You have 2 unread messages'));
document.querySelector('#help').addEventListener('click',()=>notify('Help center is opening soon'));
document.querySelector('#view-profile').addEventListener('click',()=>notify('Public profile preview is coming soon'));
document.querySelector('#all-commissions').addEventListener('click',()=>notify('Showing your active commission queue'));
document.querySelector('#open-messages').addEventListener('click',()=>notify('Inbox opened'));
document.querySelector('#add-work').addEventListener('click',()=>notify('Portfolio uploader is coming soon'));
document.querySelectorAll('.status-button').forEach(button=>button.addEventListener('click',()=>{button.textContent=button.dataset.status;button.classList.remove('progress-status');button.classList.add('ready-status');notify('Commission status updated')}));
document.querySelector('.mobile-nav').addEventListener('click',()=>notify('Navigation is available on desktop view'));
