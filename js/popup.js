(function () {
  'use strict'

  if (!!window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  document.onclick = function (evt) {
    window.browser.runtime.sendMessage({
      'type': 'popup',
      'content': evt.srcElement.id
    }, function (res) {
      window.browser.tabs.update({
        'active': true, 
        'url': res.content})
    })
  }
})()
