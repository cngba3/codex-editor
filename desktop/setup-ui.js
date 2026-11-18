const get = id => document.getElementById(id)
window.setup.subscribe(state => {
  get('stage').textContent = state.stage || 'Đang chuẩn bị…'
  get('step').textContent = state.index ? `Bước ${state.index} / ${state.total}` : ''
  if (state.detail) get('detail').textContent = state.detail
  get('error').textContent = state.error || ''
  get('retry').hidden = !state.error
  if (state.error) get('progress').value = 0
  else get('progress').removeAttribute('value')
})
get('retry').onclick = () => window.setup.retry()
get('log').onclick = () => window.setup.openLog()
