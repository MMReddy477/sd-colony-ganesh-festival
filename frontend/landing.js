const pageSelector = document.getElementById('pageSelector');

pageSelector?.addEventListener('change', event => {
  if (event.target.value === 'ganesh') window.location.assign('/ganesh-public.html');
  if (event.target.value === 'family') window.location.assign('/family-public.html');
});
