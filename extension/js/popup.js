(function () {
  'use strict'

  if (window.chrome) {
    window.browser = window.chrome
  } else {
    window.browser = browser
  }

  document.addEventListener('click', function (evt) {
    if (evt.target.id === 'updates') {
      window.browser.runtime.sendMessage({
        'type': 'popup',
        'content': evt.target.id
      }, function (res) {
        window.open(res.content)
      })
    } else {
      window.open('https://emanuelfeld.github.io/mucktweet#' + evt.target.id)
    }
  })
})()
