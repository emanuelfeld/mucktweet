(function () {
  'use strict'

  window.onload = function () {
    // let selectedMenuItem = document.querySelector('.menu-item[selected]')

  document.onclick = function (evt) {
    if (evt.srcElement.classList.contains('menu-item') && evt.srcElement.hasAttribute('selected') === false) {
      let oldSelectedMenuItem = document.querySelector('.menu-item[selected]')
      oldSelectedMenuItem.removeAttribute('selected')
      let oldSectionClass = oldSelectedMenuItem.id.split('-')[1]
      document.querySelector('div.' + oldSectionClass).style.display = 'none'

      evt.srcElement.setAttribute('selected', '')
      let sectionClass = evt.srcElement.id.split('-')[1]
      document.querySelector('div.' + sectionClass).style.display = 'block'
    } else if (evt.srcElement.id === 'user-data') {
      window.browser.runtime.sendMessage({
        'type': 'download', 
        'content': 'user'})
    } else if (evt.srcElement.id === 'tweet-data') {
      window.browser.runtime.sendMessage({
        'type': 'download', 
        'content': 'tweet'})
  
    }
  }
}

})()
